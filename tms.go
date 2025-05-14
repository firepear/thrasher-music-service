package tms

import (
	"encoding/json"
	"log"
	"io"
	"net/http"
	"strings"
	"strconv"

	tmc "github.com/firepear/thrasher-music-catalog"
)

var (
	c *tmc.Catalog
	h string
)

type queryBatch struct {
	Trks []string
	TIs  []*tmc.Track
}

type FilterReturn struct {
	FltrStr    string
	FltrVals   []any
	FltrCount  int
	TrackCount int
}

func Init(dbfile, dbname, hostname, prefix string) error {
	var err error
	c, err = tmc.New(dbfile, dbname)
	if err != nil {
		return err
	}
	h = hostname
	c.TrimPrefix = prefix
	return err
}

func HandleInit(w http.ResponseWriter, _ *http.Request) {
	j, _ := json.Marshal(map[string][]string{"artists": c.Artists, "facets": c.Facets})
	io.WriteString(w, string(j))
}

func HandleQuery(w http.ResponseWriter, r *http.Request) {
	l, _ := strconv.Atoi(r.PathValue("limit"))
	o, _ := strconv.Atoi(r.PathValue("offset"))
	trks, err := c.Query(r.PathValue("orderby"), l, o)
	if err != nil {
		log.Println(err)
		return
	}
	j, _ := json.Marshal(trks)
	io.WriteString(w, string(j))
}

func HandleTrkInfo(w http.ResponseWriter, r *http.Request) {
	trk := strings.ReplaceAll(r.PathValue("trk"), "%2F", "/")
	j, _ := json.Marshal(c.TrkInfo(trk))
	io.WriteString(w, string(j))
}

func HandleBatchTrkInfo(w http.ResponseWriter, r *http.Request) {
	o, _ := strconv.Atoi(r.PathValue("offset"))
	trks, err := c.Query(r.PathValue("orderby"), 100, o)
	if err != nil {
		log.Println(err)
		return
	}
	qb := &queryBatch{}
	qb.Trks = append(qb.Trks, trks...)

	for _, trk := range trks {
		qb.TIs = append(qb.TIs, c.TrkInfo(trk))
	}
	j, _ := json.Marshal(qb)
	io.WriteString(w, string(j))
}

func HandleFilter(w http.ResponseWriter, r *http.Request) {
	err := c.Filter(strings.ReplaceAll(r.PathValue("format"), "%2F", "/"))
	if err != nil {
		log.Println(err)
		return
	}
	j, _ := json.Marshal(FilterReturn{FltrStr: c.FltrStr, FltrVals: c.FltrVals, FltrCount: c.FltrCount, TrackCount: c.TrackCount})
	io.WriteString(w, string(j))
}

