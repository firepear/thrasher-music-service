package main

import (
	///"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"net/http"
	"strings"
	"strconv"

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

	flag.StringVar(&clientDir, "c", "", "dir for serving client files")
	flag.StringVar(&dbFile, "db", "", "path to database")
	flag.StringVar(&hostname, "h", "", "hostname for server")
	flag.StringVar(&port, "p", "", "port for server")
	flag.StringVar(&portRange, "pr", "", "port range for spawned servers (e.g. '9000-9500')")
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
	pchunks := strings.Split(portRange, "-")
	portLo, _ = strconv.Atoi(strings.TrimSpace(pchunks[0]))
	portHi, _ = strconv.Atoi(strings.TrimSpace(pchunks[1]))

	srvrs = map[int]Srvr{}
}

///////////

func handleSpawn(w http.ResponseWriter, _ *http.Request) {
	var err error
	// create new Catalog
	c, err = tmc.New(conf)
	if err != nil {
		return err
	}
	c.TrimPrefix = prefix

	// find an available port

	// make a new Srvr
	s := &tms.Srvr{Http: &http.Server{Addr: fmt.Sprintf("%s:%s", hostname, port)}, C: c}
	// set up its handlers
	s.http.Handle("/", http.FileServer(http.Dir(clientDir)))
	s.http.Handle("/music/", http.StripPrefix("/music/", http.FileServer(http.Dir(musicDir))))
	s.http.HandleFunc("GET /ping", tms.HandlePing)
	s.http.HandleFunc("GET /init", tms.HandleInit)
	s.http.HandleFunc("GET /f/{format}", tms.HandleFilter)
	s.http.HandleFunc("GET /q/{orderby}/{limit}/{offset}", tms.HandleQuery)
	s.http.HandleFunc("GET /i/{trk}", tms.HandleTrkInfo)
	s.http.HandleFunc("GET /i/batch/{orderby}/{offset}", tms.HandleBatchTrkInfo)
	// launch it
	s.http.ListenAndServe()
	// add it to srvrs
	srvrs[port] = s
}

///////////

func main() {
	hp := fmt.Sprintf("%s:%s", hostname, port)
	mainSrv = http.NewServeMux()
	mainSrv.HandleFunc("GET /new", handleSpawn)
	log.Fatal(mainSrv.ListenAndServe(hp, nil))
}
