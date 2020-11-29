#' Load a Matrix
#'
#' This function loads a file as a matrix. It assumes that the first column
#' contains the rownames and the subsequent columns are the sample identifiers.
#' Any rows with duplicated row names will be dropped with the first one being
#' kepted.
#'
#' @name jeziki
#' @return List of available languages
#' @export
#' @rdname jeziki
jeziki <- function() {
	#resp = "BLA"
	#resp
	

	library(httr)
	library(jsonlite)
	path <- "http://192.168.1.106/jobe/index.php/restapi/languages"

	r <- GET(url = path)

	#r <- GET(url = "192.168.1.106/jobe/index.php/restapi/languages")
	jeziki = fromJSON(rawToChar(r$content))
	jeziki
	#fromJSON(content(r), flatten = TRUE)
    #str(content(r))
}

#' @return Number of free port
#' @export
prostiPorti <- function() {
	library(httr)
	library(jsonlite)
	path <- "http://192.168.1.106/jobe/index.php/restapi/free_ports"

	r <- GET(url = path)

	jeziki = fromJSON(rawToChar(r$content))
	jeziki
}

#' @return Number of free port
#' @export
neki <- function() {
	jeziki = "BLA"
	neki = "NEKI"
	print(jeziki)
	neki
}

