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
	hostname    string
	listenIF    string
	listenPort  int
	srvrPorts   string
	portLo      int
	portHi      int
	redirHost   string
	tls         bool
	srvrs       map[int]*tms.Srvr
	srvrTTL     int
	conf        *tmc.Config
	lastCatMod  time.Time
	catNum      int
	version     string
)

func init() {
	version = "v0.16.0"
	// read config file, if it exists
	var err error
	conf, err = tmc.ReadConfig()
	if err != nil {
		fmt.Printf("error reading config: %s; continuing with null config...\n", err)
		conf = &tmc.Config{}
	}

	flag.StringVar(&clientDir, "cd", "", "dir for serving client files")
	flag.StringVar(&listenIF, "li", "", "hostname for server-generated URLs")
	flag.IntVar(&listenPort, "lp", 0, "name/IP for server to listen on")
	flag.StringVar(&redirHost, "rh", "", "hostname for redirect URLs")
	flag.StringVar(&srvrPorts, "sp", "", "port range for spawned servers")
	flag.BoolVar(&tls, "tls", false, "build redirect URLs with https")
	flag.IntVar(&srvrTTL, "ttl", 0, "spawned server TTL in seconds")
	flag.Parse()

	// get the initial modtime of the catalog file
	s, err := os.Stat(conf.DbFile)
	if err != nil {
		log.Panic(err)
	}
	lastCatMod = s.ModTime()

	// set listen if/hostname if we have an override
	if listenIF != "" {
		conf.ListenIF = listenIF
	}
	// and redirHost
	if redirHost != "" {
		conf.RedirHost = redirHost
	}
	// and listen port
	if listenPort != 0 {
		conf.ListenPort = listenPort
	}
	// and portRange
	if srvrPorts != "" {
		conf.PortRange = srvrPorts
	}
	// and TLS
	if tls != false {
		conf.TLS = tls
	}
	// and TTL
	if srvrTTL != 0 {
		conf.TTL = srvrTTL
	}

	// set clientDir if it isn't
	if clientDir == "" {
		_, err := os.Stat("/var/local/tms-backend")
		if err == nil {
			clientDir = "/var/local/tms-backend"
		} else {
			_, err := os.Stat("./client")
			if err == nil {
				clientDir = "./client"
			} else {
				log.Printf("no static content dir found: %s", err)
				os.Exit(1)
			}
		}
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
		if etime > conf.TTL {
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

	// find an available port
	sport := 0
	for sport == 0 || srvrs[sport] != nil {
		sport = rand.IntN(portHi - portLo) + portLo
	}
	ssport := strconv.Itoa(sport)

	// make a new Srvr and mux
	addr := conf.ListenIF + ":" + ssport
	raddr := conf.RedirHost + ":" + ssport
	s := &tms.Srvr{Http: &http.Server{Addr: addr}, Host: conf.RedirHost,
		Port: ssport, OrigPort: conf.ListenPort, C: c, Version: version}
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
	// add it to srvrs
	srvrs[sport] = s
	// redireco the new Srvr
	if conf.TLS {
		http.Redirect(w, r, "https://" + raddr + r.URL.Path, http.StatusSeeOther)
	} else {
		http.Redirect(w, r, "http://" + raddr + r.URL.Path, http.StatusSeeOther)
	}
	log.Println("srvr up:", raddr , "tls", conf.TLS, "path", r.URL.Path)
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
	log.Printf("listening on %s:%d", conf.ListenIF, conf.ListenPort)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%d", conf.ListenIF, conf.ListenPort), mainSrv))
}
