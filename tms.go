package tms

import (
	"encoding/json"
	//"fmt"
	"net/http"
	"io"

	tmc "github.com/firepear/thrasher-music-catalog"
)

var (
	c *tmc.Catalog
)

func Init(dbfile, dbname string) error {
	var err error
	c, err = tmc.New(dbfile, dbname)
	return err
}


func HandleInit(w http.ResponseWriter, _ *http.Request) {
	j, _ := json.Marshal(map[string][]string{"artists": c.Artists, "facets": c.Facets})
	io.WriteString(w, string(j))
}

