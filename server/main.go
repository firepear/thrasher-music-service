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
	hostname    string
	port        string
	portRange   string
	portLo      int
	portHi      int
	musicDir    string
	musicPrefix string
	srvrs       map[int]*tms.Srvr
	conf        *tmc.Config
)

func init() {
	// read config file, if it exists
	var err error
	conf, err = tmc.ReadConfig()
	if err != nil {
		fmt.Printf("error reading config: %s; continuing with null config...\n", err)
		conf = &tmc.Config{}
	}

	flag.StringVar(&clientDir, "c", "../client", "dir for serving client files")
	flag.StringVar(&dbFile, "db", "", "path to database")
	flag.StringVar(&hostname, "h", "localhost:8000", "hostname for server")
	flag.StringVar(&portRange, "pr", "8001-8030", "port range for spawned servers")
	flag.StringVar(&musicDir, "md", "", "dir for serving music files")
	flag.StringVar(&musicPrefix, "mp", "", "leading musicdir path which will be stripped from filter results (defaults to musicdir)")
	flag.Parse()

	// if fdbfile is set, override dbfile
	if dbFile != "" {
		conf.DbFile = dbFile
	}
	// ditto musicdir
	if musicDir != "" {
		conf.MusicDir = musicDir
	}
	// and hostname
	if hostname != "localhost:8000" {
		conf.Hostname = hostname
	}
	// and portRange
	if portRange != "8001-8030" {
		conf.PortRange = portRange
	}
	// and if we still don't have a dbfile, bail
	if conf.DbFile == "" {
		fmt.Println("database file must be specified; see -h")
		os.Exit(1)
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
	hchunks := strings.Split(conf.Hostname, ":")
	hostname = hchunks[0]
	port = hchunks[1]

	srvrs = map[int]*tms.Srvr{}
}

///////////

func scanSrvrs() {
	// get current time
	curtime := int(time.Now().Unix())
	for port, s := range srvrs {
		etime := curtime - s.LastPing
		if etime > 40 {
			log.Printf("srvr on port %d last seen %ds ago; shutdown", port, etime)
			s.Http.Close()
			delete(srvrs, port)
		}
	}
}

func handleSpawn(w http.ResponseWriter, r *http.Request) {
	if len(srvrs) == portHi - portLo {
		io.WriteString(w, "server's full")
		return
	}
	// create new Catalog
	c, err := tmc.New(conf, "tmssrvr")
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

	// make a new Srvr and mux
	addr := fmt.Sprintf("%s:%d", hostname, sport)
	s := &tms.Srvr{Http: &http.Server{Addr: addr}, Host: hostname, Port: strconv.Itoa(sport),
		OrigPort: port, C: c}
	mux := http.NewServeMux()
	// set up its handlers
	mux.Handle("/", http.FileServer(http.Dir(clientDir)))
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
	log.Printf("new srvr on %s", addr)
	// add it to srvrs
	srvrs[sport] = s
	http.Redirect(w, r, "http://" + addr, http.StatusSeeOther)
}

///////////

func main() {
	// launch Srvr scanner
	tickr := time.NewTicker(30 * time.Second)
	go func() {
		for {
			select {
			case <-tickr.C:
				scanSrvrs()
			}
		}
	}()
	mainSrv := http.NewServeMux()
	mainSrv.HandleFunc("GET /", handleSpawn)
	log.Printf("listening on %s", conf.Hostname)
	log.Fatal(http.ListenAndServe(conf.Hostname, mainSrv))
}
