package main

import (
	///"encoding/json"
	"flag"
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
	c.TrimPrefix = musicPrefix
}

///////////

///////////

func main() {
	err := tms.Init(dbFile, "tmshttp")
	if err != nil {
	log.Fatal(err)
}
	http.Handle("/", http.FileServer(http.Dir(clientDir)))
	http.Handle("/music", http.FileServer(http.Dir(musicDir)))
	http.HandleFunc("GET /init", tms.HandleInit)
	//http.HandleFunc("GET /f/{format}", handleFilter)
	///http.HandleFunc("GET /q/{orderby}/{limit}/{offset}", handleQuery)
	//http.HandleFunc("GET /i/{trk}", handleTrkInfo)
	log.Fatal(http.ListenAndServe(":8080", nil))
}


// const x = await fetch("http://10.1.10.210:8080/init").then(response => {return response.json()});
