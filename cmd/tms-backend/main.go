package main

import (
	///"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"math/rand/v2"
	"net/http"
	"strings"
	"strconv"
	"time"

	tmc "github.com/firepear/thrasher-music-catalog"
	tms "github.com/firepear/thrasher-music-service"
)

var (
	clientDir   string
	dbFile      string
	listen      int
	port        string
	hostname    string
	portRange   string
	portLo      int
	portHi      int
	tls         bool
	tlsHost     string
	musicDir    string
	musicPrefix string
	srvrs       map[int]*tms.Srvr
	srvrTTL     int
	conf        *tmc.Config
	lastCatMod  time.Time
	catNum      int
)

func init() {
	// read config file, if it exists
	var err error
	conf, err = tmc.ReadConfig()
	if err != nil {
		fmt.Printf("error reading config: %s; continuing with null config...\n", err)
		conf = &tmc.Config{}
	}

	flag.StringVar(&clientDir, "c", "", "dir for serving client files")
	flag.StringVar(&dbFile, "db", "", "path to database")
	flag.StringVar(&hostname, "hn", "", "hostname for server-generated URLs")
	flag.StringVar(&tlsHost, "th", "", "hostname for TLS redirect URLs")
	flag.IntVar(&listen, "l", 0, "name/IP for server to listen on")
	flag.StringVar(&musicDir, "md", "", "dir for serving music files")
	flag.StringVar(&musicPrefix, "mp", "", "leading musicdir path which will be stripped from filter results (defaults to musicdir)")
	flag.StringVar(&portRange, "pr", "", "port range for spawned servers")
	flag.BoolVar(&tls, "tls", false, "build redirect URLs with https")
	flag.IntVar(&srvrTTL, "ttl", 0, "TTL in seconds")
	flag.Parse()

	// if fdbfile is set, override dbfile
	if dbFile != "" {
		conf.DbFile = dbFile
	}
	// and if we still don't have a dbfile, bail
	if conf.DbFile == "" {
		fmt.Println("database file must be specified; see -h")
		os.Exit(1)
	}
	// get the initial modtime of the catalog file
	s, _ := os.Stat(conf.DbFile)
	lastCatMod = s.ModTime()

	// now set musicdir
	if musicDir != "" {
		conf.MusicDir = musicDir
	}
	// and hostname, tlsHost
	if hostname != "" {
		conf.Hostname = hostname
	}
	if tlsHost != "" {
		conf.TLSHost = tlsHost
	}
	// and listen value
	if listen != 0 {
		conf.Listen = listen
	}
	// and portRange
	if portRange != "" {
		conf.PortRange = portRange
	}
	// and TLS
	if tls != false {
		conf.TLS = tls
	}
	// and TTL
	if srvrTTL != 0 {
		conf.TTL = srvrTTL
	}
	// and clientDir
	if clientDir != "" {
		conf.Clientdir = clientDir
	}

	// mirror musicDir to musicPrefix if not specified
	if musicPrefix == "" {
		musicPrefix = conf.MusicDir
	}

	// parse portRange
	pchunks := strings.Split(conf.PortRange, "-")
	portLo, _ = strconv.Atoi(strings.TrimSpace(pchunks[0]))
	portHi, _ = strconv.Atoi(strings.TrimSpace(pchunks[1]))
	// get just the hostname for server spawning

	srvrs = map[int]*tms.Srvr{}
}


// scanSrvrs is fired from the ticker in main(). it iterates over the
// list of spawned servers and kills off any which have not been heard
// from in srvrTTL seconds
func scanSrvrs() {
	// get current time
	curtime := int(time.Now().Unix())
	for port, s := range srvrs {
		etime := curtime - s.LastPing
		if etime > srvrTTL {
			log.Printf("srvr on port %d last seen %ds ago; shutdown", port, etime)
			s.Http.Close()
			s.C.Close()
			delete(srvrs, port)
		}
	}
}


// statCat is fired from the ticker in main(). it checks the modtime
// of conf.DbFile and terminates all spawned servers if it does not
// match the stored modtime
func statCat() {
	s, _ := os.Stat(conf.DbFile)
	if s.ModTime().Sub(lastCatMod) != 0 {
		log.Printf("catalog update; killing all spawned servers")
		for port, s := range srvrs {
			s.Http.Close()
			s.C.Close()
			delete(srvrs, port)
		}
		lastCatMod = s.ModTime()
		catNum++
	}
}


func handleSpawn(w http.ResponseWriter, r *http.Request) {
	if len(srvrs) == portHi - portLo {
		io.WriteString(w, "server's full")
		return
	}

	// create new Catalog
	c, err := tmc.New(conf, "tmssrvr"  + strconv.Itoa(catNum))
	if err != nil {
		log.Println(err)
		io.WriteString(w, fmt.Sprintf("oops: %s", err))
		return
	}
	c.TrimPrefix = musicPrefix

	// find an available port
	sport := 0
	for sport == 0 || srvrs[sport] != nil {
		sport = rand.IntN(portHi - portLo) + portLo
	}
	ssport := strconv.Itoa(sport)

	// make a new Srvr and mux
	addr := conf.Hostname + ":" + ssport
	raddr := addr
	s := &tms.Srvr{Http: &http.Server{Addr: addr}, Host: conf.Hostname,
		Port: ssport, OrigPort: conf.Listen, C: c}
	mux := http.NewServeMux()
	// set up its handlers
	mux.Handle("/", http.FileServer(http.Dir(conf.Clientdir)))
	mux.Handle("/music/", http.StripPrefix("/music/", http.FileServer(http.Dir(conf.MusicDir))))
	mux.HandleFunc("GET /ping", s.HandlePing)
	mux.HandleFunc("GET /init", s.HandleInit)
	mux.HandleFunc("GET /f/{format}", s.HandleFilter)
	mux.HandleFunc("GET /q/{orderby}/{limit}/{offset}", s.HandleQuery)
	mux.HandleFunc("GET /qr", s.HandleRecent)
	mux.HandleFunc("GET /i/{trk}", s.HandleTrkInfo)
	mux.HandleFunc("GET /i/batch/{orderby}/{offset}", s.HandleBatchTrkInfo)
	s.Http.Handler = mux
	// set the last ping time
	s.LastPing = int(time.Now().Unix())
	// launch it
	go s.Http.ListenAndServe()
	// add it to srvrs
	srvrs[sport] = s
	// redireco the new Srvr
	if conf.TLS {
		raddr = conf.TLSHost + ":" + ssport
		http.Redirect(w, r, "https://" + raddr + r.URL.Path, http.StatusSeeOther)
	} else {
		http.Redirect(w, r, "http://" + raddr + r.URL.Path, http.StatusSeeOther)
	}
	log.Println("srvr up:", addr , "tls", conf.TLS, "redir", raddr, "path", r.URL.Path)
}


func main() {
	// create a ticker
	tickr := time.NewTicker(30 * time.Second)
	// run scanSrves and statCat every time the ticket goes off
	go func() {
		for {
			select {
			case <-tickr.C:
				scanSrvrs()
				statCat()
			}
		}
	}()

	// launch the main/listener server
	mainSrv := http.NewServeMux()
	mainSrv.HandleFunc("GET /", handleSpawn)
	log.Printf("listening on %s:%d", conf.Hostname, conf.Listen)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%d", conf.Hostname, conf.Listen), mainSrv))
}
