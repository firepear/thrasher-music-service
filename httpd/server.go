package main

import (
	///"encoding/json"
	"flag"
	//"fmt"
	"log"
	"net/http"

	tms "github.com/firepear/thrasher-music-service"
)

var (
	clientDir   string
	dbFile      string
	musicDir    string
	musicPrefix string
)

func init() {
	flag.StringVar(&clientDir, "c", "", "dir for serving client files")
	flag.StringVar(&dbFile, "d", "", "path to database")
	flag.StringVar(&musicDir, "m", "", "dir for serving music files")
	flag.StringVar(&musicPrefix, "p", "", "leading musicdir path which will be stripped from filter results")
	flag.Parse()
}

///////////

///////////

func main() {
	err := tms.Init(dbFile, "tmshttpd", musicPrefix)
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", http.FileServer(http.Dir(clientDir)))
	http.Handle("/music/", http.StripPrefix("/music/", http.FileServer(http.Dir(musicDir))))
	http.HandleFunc("GET /init", tms.HandleInit)
	http.HandleFunc("GET /f/{format}", tms.HandleFilter)
	//http.HandleFunc("GET /q", tms.HandleQuery)
	http.HandleFunc("GET /q/{orderby}/{limit}/{offset}", tms.HandleQuery)
	http.HandleFunc("GET /i/{trk}", tms.HandleTrkInfo)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
