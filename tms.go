package tms

import (
	"encoding/json"
	"log"
	"io"
	"net/http"
	"strings"
	"strconv"
	"time"

	tmc "github.com/firepear/thrasher-music-catalog"
)

var Version = "v0.20.0"

type Srvr struct {
	Http     *http.Server
	C        *tmc.Catalog
	Host     string
	Port     string
	OrigPort int
	LastPing int
	Version  string
}

type queryBatch struct {
	Trks []string
	TIs  []*tmc.Track
}

type FilterReturn struct {
	Err        string
	FltrStr    string
	FltrVals   []any
	FltrCount  int
	TrackCount int
}

func (s *Srvr) HandleInit(w http.ResponseWriter, _ *http.Request) {
	j, _ := json.Marshal(map[string][]string{"artists": s.C.Artists, "facets": s.C.Facets,
		"meta": []string{s.Host, s.Port, strconv.Itoa(s.OrigPort), s.Version}})
	io.WriteString(w, string(j))
}

func (s *Srvr) HandlePing(w http.ResponseWriter, _ *http.Request) {
	t := int(time.Now().Unix())
	s.LastPing = t
	io.WriteString(w, `{"ping":true}`)
}

func (s *Srvr) HandleQuery(w http.ResponseWriter, r *http.Request) {
	l, _ := strconv.Atoi(r.PathValue("limit"))
	o, _ := strconv.Atoi(r.PathValue("offset"))
	trks, err := s.C.Query(r.PathValue("orderby"), l, o)
	if err != nil {
		log.Println(err)
		return
	}
	j, _ := json.Marshal(trks)
	io.WriteString(w, string(j))
}

func (s *Srvr) HandleRecent(w http.ResponseWriter, r *http.Request) {
	var err error
	err = s.C.QueryRecent()
	if err != nil {
		log.Println(err)
		log.Println(s.C.QueryStr, s.C.QueryVals)
		return
	}
	j, _ := json.Marshal(FilterReturn{FltrStr: s.C.FltrStr, FltrVals: s.C.FltrVals, FltrCount: s.C.FltrCount, TrackCount: s.C.TrackCount})
	io.WriteString(w, string(j))
}

func (s *Srvr) HandleTrkInfo(w http.ResponseWriter, r *http.Request) {
	trk := strings.ReplaceAll(r.PathValue("trk"), "%2F", "/")
	j, _ := json.Marshal(s.C.TrkInfo(trk))
	io.WriteString(w, string(j))
}

func (s *Srvr) HandleBatchTrkInfo(w http.ResponseWriter, r *http.Request) {
	o, _ := strconv.Atoi(r.PathValue("offset"))
	trks, err := s.C.Query(r.PathValue("orderby"), 100, o)
	if err != nil {
		log.Println(err)
		log.Println(s.C.QueryStr, s.C.QueryVals)
		return
	}
	qb := &queryBatch{}
	qb.Trks = append(qb.Trks, trks...)

	for _, trk := range trks {
		qb.TIs = append(qb.TIs, s.C.TrkInfo(trk))
	}
	j, _ := json.Marshal(qb)
	io.WriteString(w, string(j))
}

func (s *Srvr) HandleFilter(w http.ResponseWriter, r *http.Request) {
	err := s.C.Filter(strings.ReplaceAll(r.PathValue("format"), "%2F", "/"))
	if err != nil {
		j, _ := json.Marshal(FilterReturn{Err: err.Error(), FltrStr: s.C.FltrStr, FltrVals: s.C.FltrVals, FltrCount: s.C.FltrCount, TrackCount: s.C.TrackCount})
		io.WriteString(w, string(j))
		return
	}
	j, _ := json.Marshal(FilterReturn{Err: "", FltrStr: s.C.FltrStr, FltrVals: s.C.FltrVals, FltrCount: s.C.FltrCount, TrackCount: s.C.TrackCount})
	io.WriteString(w, string(j))
}

