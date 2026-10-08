//go:build windows || plan9

package main

import (
	"errors"
	"io"
)

func dialSyslog() (io.Writer, error) {
	return nil, errors.New("syslog is not supported on this platform")
}
