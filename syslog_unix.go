//go:build !windows && !plan9

package main

import (
	"io"
	"log/syslog"
)

func dialSyslog() (io.Writer, error) {
	return syslog.Dial("tcp", "localhost:5555", syslog.LOG_INFO, "browser")
}
