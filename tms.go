package tms

import (
	"encoding/json"
	"log"
	"io"
	"net/http"
	"strings"

	tmc "github.com/firepear/thrasher-music-catalog"
)

var (
	c *tmc.Catalog
)

type FilterReturn struct {
	FltrStr   string
	FltrVals  []any
	FltrCount int
}

func Init(dbfile, dbname, prefix string) error {
	var err error
	c, err = tmc.New(dbfile, dbname)
	if err != nil {
		return err
	}
	c.TrimPrefix = prefix
	return err
}

func HandleInit(w http.ResponseWriter, _ *http.Request) {
	j, _ := json.Marshal(map[string][]string{"artists": c.Artists, "facets": c.Facets})
	io.WriteString(w, string(j))
}

func HandleQuery(w http.ResponseWriter, _ *http.Request) {
	trks, err := c.Query("", 0, 0)
	if err != nil {
		log.Println(err)
		return
	}
	j, _ := json.Marshal(trks)
	io.WriteString(w, string(j))
}

func HandleFilter(w http.ResponseWriter, r *http.Request) {
	format := r.PathValue("format")
	format = strings.ReplaceAll(format, "%2F", "/")
	err := c.Filter(format)
	if err != nil {
		log.Println(err)
		return
	}
	j, _ := json.Marshal(FilterReturn{FltrStr: c.FltrStr, FltrVals: c.FltrVals, FltrCount: c.FltrCount})
	io.WriteString(w, string(j))
}

