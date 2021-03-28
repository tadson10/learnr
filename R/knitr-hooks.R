
install_knitr_hooks <- function() {

  # set global tutorial option which we can use as a basis for hooks
  # (this is so we don't collide with hooks set by the user or
  # by other packages or Rmd output formats)
  knitr::opts_chunk$set(tutorial = TRUE)

  # helper to check for runtime: shiny_prerendered being active
  is_shiny_prerendered_active <- function() {
    identical(knitr::opts_knit$get("rmarkdown.runtime"), "shiny_prerendered")
  }

  # helper to check for an exercise chunk
  is_exercise_chunk <- function(options) {
    isTRUE(options[["exercise"]])
  }

  # helper to find chunks that name a chunk as their setup chunk
  exercise_chunks_for_setup_chunk <- function(label) {
    label_query <- paste0("knitr::all_labels(exercise.setup == '", label, "')")
    eval(parse(text = label_query))
  }

  # helper to check for an exercise support chunk
  is_exercise_support_chunk <- function(options, type = c("setup",
                                                          "hint",
                                                          "hint-\\d+",
                                                          "solution",
                                                          "code-check",
                                                          "check")) {
    support_regex <- paste0("-(", paste(type, collapse = "|"), ")$")
    if (grepl(support_regex, options$label)) {
      exercise_label <- sub(support_regex, "", options$label)
      label_query <- "knitr::all_labels(exercise == TRUE)"
      all_exercise_labels <- eval(parse(text = label_query))
      exercise_label %in% all_exercise_labels
    }
    else if ("setup" %in% type) {
      # look for another chunk which names this as it's setup chunk
      length(exercise_chunks_for_setup_chunk(options$label)) > 0
    }
    else {
      FALSE
    }
  }

  # helper function to grab the raw knitr chunk associated with a chunk label
  get_knitr_chunk <- function(label) {
    # Note: we directly call the knitr function in this case because we do not
    # need to pass expressions which required delayed evaluation.
    knitr::knit_code$get(label)
  }

  get_reveal_solution_option <- function(solution_opts) {
    exercise_chunk <- get_knitr_chunk(sub("-solution$", "", solution_opts$label))
    if (is.null(exercise_chunk)) {
      stop("Can not find exercise chunk for solution: `", solution_opts$label, "`")
    }

    # these are unevaluated options at this point
    exercise_opts <- attr(exercise_chunk, "chunk_opts")
    # get explicit opts on solution chunk since solution_opts was merged
    # with the global knitr chunk options
    sol_opts_user <- attr(get_knitr_chunk(solution_opts$label), "chunk_opts")

    # Determine if we should reveal the solution using...
    reveal_solution <-
    # 1. the option explicitly set on the solution chunk
    eval(sol_opts_user$exercise.reveal_solution, envir = knitr::knit_global()) %||%
    # 2. the option explicitly set on the exercise chunk
    eval(exercise_opts$exercise.reveal_solution, envir = knitr::knit_global()) %||%
    # 3. the global knitr chunk option
    solution_opts$exercise.reveal_solution %||%
    # 4. the global R option
    getOption("tutorial.exercise.reveal_solution", TRUE)

    isTRUE(reveal_solution)
  }


  # hook to turn off evaluation/highlighting for exercise related chunks
  knitr::opts_hooks$set(tutorial = function(options) {

    # check for chunk type
    exercise_chunk <- is_exercise_chunk(options)
    exercise_support_chunk <- is_exercise_support_chunk(options)
    exercise_setup_chunk <- is_exercise_support_chunk(options, type = "setup")

    # validate that we have runtime: shiny_prerendered
    if ((exercise_chunk || exercise_support_chunk) && !is_shiny_prerendered_active()) {
      stop("Tutorial exercises require the use of 'runtime: shiny_prerendered'",
           call. = FALSE)
    }

    # if this is an exercise chunk then set various options
    if (exercise_chunk) {

      # one time tutor initialization
      initialize_tutorial()

      options$echo <- TRUE
      options$include <- TRUE
      options$highlight <- FALSE
      options$comment <- NA
      if (!is.null(options$exercise.eval))
        options$eval <- options$exercise.eval
      else
        options$eval <- FALSE
    }

    # if this is an exercise support chunk then force echo, but don't
    # eval or highlight it
    if (exercise_support_chunk) {
      options$echo <- TRUE
      options$include <- TRUE
      options$eval <- FALSE
      options$highlight <- FALSE
    }

    if (is_exercise_support_chunk(options, type = "solution")) {
      # only print solution if exercise.reveal_solution is TRUE
      options$echo <- get_reveal_solution_option(options)
    }

    # if this is an exercise setup chunk then eval it if the corresponding
    # exercise chunk is going to be executed
    if (exercise_setup_chunk) {

      # figure out the default behavior
      exercise_eval <- knitr::opts_chunk$get('exercise.eval')
      if (is.null(exercise_eval))
        exercise_eval <- FALSE

      # look for chunks that name this as their setup chunk
      labels <- exercise_chunks_for_setup_chunk(options$label)
      if (grepl("-setup$", options$label))
        labels <- c(labels, sub("-setup$", "", options$label))
      labels <- paste0('"', labels, '"')
      labels <- paste0('c(', paste(labels, collapse = ', '), ')')
      label_query <- paste0("knitr::all_labels(label %in% ", labels, ", ",
                            "identical(exercise.eval, ", !exercise_eval, "))")

      default_reversed <- length(eval(parse(text = label_query))) > 0
      if (default_reversed)
        exercise_eval <- !exercise_eval

      # set the eval property as appropriate
      options$eval <- exercise_eval
    }

    # return modified options
    options
  })

  # hook to amend output for exercise related chunks
  knitr::knit_hooks$set(tutorial = function(before, options, envir) {
    # helper to produce an exercise wrapper div w/ the specified class
    exercise_wrapper_div <- function(suffix = NULL, extra_html = NULL) {
      # before exercise
      if (before) {
        if (!is.null(suffix))
          suffix <- paste0("-", suffix)
        class <- paste0("exercise", suffix)
        lines <- ifelse(is.numeric(options$exercise.lines),
                        options$exercise.lines, 0)
        completion <- as.numeric(options$exercise.completion %||% 1 > 0)
        diagnostics <- as.numeric(options$exercise.diagnostics %||% 1 > 0)
        startover <- as.numeric(options$exercise.startover %||% 1 > 0)
        caption <- ifelse(is.null(options$exercise.cap), "Code", options$exercise.cap)
        type <- ifelse(is.null(options$exercise.type), "r", options$exercise.type)
        serverIP <- options$exercise.serverIP
        id <- options$exercise.id
        paste0('<div class="tutorial-', class,
               '" data-label="', options$label,
               '" data-caption="', caption,
               '" data-completion="', completion,
               '" data-diagnostics="', diagnostics,
               '" data-startover="', startover,
               '" data-serverIP="', serverIP,
               '" data-type="', type,
               '" data-id="', id,
               '" data-lines="', lines, '">')
      }
      # after exercise
      else {
        c(extra_html, '</div>')
      }
    }

    # handle exercise chunks
    if (is_exercise_chunk(options)) {

      # one-time dependencies/server code
      extra_html <- NULL
      if (before) {

        # verify the chunk has a label if required
        verify_tutorial_chunk_label()

        # verify the chunk meets requirements for JS exercise 
        verify_tutorial_chunk_js()

        # inject ace and clipboardjs dependencies
        knitr::knit_meta_add(list(
          list(ace_html_dependency()),
          list(clipboardjs_html_dependency())
        ))

        # write server code
        exercise_server_chunk(options$label)
      }
      else {
        # forward a subset of standard knitr chunk options
        preserved_options <- list()
        preserved_options$fig.width <- options$fig.width
        preserved_options$fig.height <- options$fig.height
        preserved_options$fig.retina <- options$fig.retina
        preserved_options$fig.asp <- options$fig.asp
        preserved_options$fig.align <- options$fig.align
        preserved_options$fig.keep <- options$fig.keep
        preserved_options$fig.show <- options$fig.show
        preserved_options$fig.cap <- options$fig.cap
        preserved_options$out.width <- options$out.width
        preserved_options$out.height <- options$out.height
        preserved_options$out.extra <- options$out.extra
        preserved_options$warning <- options$warning
        preserved_options$error <- options$error
        preserved_options$message <- options$message

        # forward some exercise options
        preserved_options$exercise.df_print <- knitr::opts_knit$get('rmarkdown.df_print')
        if (is.null(preserved_options$exercise.df_print))
          preserved_options$exercise.df_print <- "default"
        preserved_options$exercise.timelimit <- options$exercise.timelimit
        preserved_options$exercise.setup <- options$exercise.setup
        preserved_options$exercise.checker <- deparse(options$exercise.checker)
        preserved_options$exercise.type <- ifelse(is.null(options$exercise.type), "r", options$exercise.type)
        preserved_options$exercise.serverIP <- ifelse(is.null(options$exercise.serverIP), "", options$exercise.serverIP)
        preserved_options$exercise.caption <- ifelse(is.null(options$exercise.cap), "Code", options$exercise.cap)

        print(jsonlite::toJSON(preserved_options, auto_unbox = TRUE))
        # script tag with knit options for this chunk
        extra_html <- c('<script type="application/json" data-opts-chunk="1">',
                        jsonlite::toJSON(preserved_options, auto_unbox = TRUE),
                        '</script>')
      }

      # wrapper div (called for before and after)
      exercise_wrapper_div(extra_html = extra_html)
    }

    # handle exercise support chunks (setup, solution, and check)
    else if (is_exercise_support_chunk(options)) {

      # setup and checking code (-setup, -code-check, and -check) are included in exercise cache
      # do not send the setup and checking code to the browser

      # send hint and solution to the browser
      # these are visibly displayed in the UI
      if (is_exercise_support_chunk(options, type = c("hint", "hint-\\d+"))) {
        exercise_wrapper_div(suffix = "support")
      } else if (is_exercise_support_chunk(options, type = "solution")) {
        if (get_reveal_solution_option(options)) {
          exercise_wrapper_div(suffix = "support")
        }
      }
    }


  })
}

remove_knitr_hooks <- function() {
  knitr::opts_hooks$set(tutorial = NULL)
  knitr::knit_hooks$set(tutorial = NULL)
}

exercise_server_chunk <- function(label) {

  # reactive for exercise execution
  rmarkdown::shiny_prerendered_chunk('server', sprintf(
  '`tutorial-exercise-%s-result` <- learnr:::setup_exercise_handler(reactive(req(input$`tutorial-exercise-%s-code-editor`)), session)
output$`tutorial-exercise-%s-output` <- renderUI({
  `tutorial-exercise-%s-result`()
})', label, label, label, label))
}


verify_tutorial_chunk_label <- function() {
  if (!isTRUE(getOption("knitr.in.progress"))) return()

  label <- knitr::opts_current$get('label')
  unnamed_label <- knitr::opts_knit$get('unnamed.chunk.label')
  if (isTRUE(grepl(paste0('^', unnamed_label), label))) {
    stop("Code chunks with exercises or quiz questions must be labeled.",
         call. = FALSE)
  }
  not_valid_char_regex <- "[^a-zA-Z0-9_-]"
  if (grepl(not_valid_char_regex, label)) {
    stop(
      "Code chunks labels for exercises or quiz questions must only be labeled using:",
      "\n\tlower case letters: a-z",
      "\n\tupper case letters: A-Z",
      "\n\tnumbers case letters: 0-9",
      "\n\tunderscore: _",
      "\n\tdash: -",
      "\n\nCurrent label: \"", label, "\"",
      "\n\nTry using: \"", gsub(not_valid_char_regex, "_", label), "\"",
      call. = FALSE
    )
  }
}


check_empty_value <- function(variable) {
  variable <- ifelse(is.null(variable), "", variable)
  ifelse(variable == "", TRUE, FALSE)
}

verify_tutorial_chunk_js <- function() {
  if (!isTRUE(getOption("knitr.in.progress"))) return()

  caption <- knitr::opts_current$get('exercise.cap')
  type <- knitr::opts_current$get('exercise.type')
  exerciseId <- knitr::opts_current$get('exercise.id')
  serverIP <- knitr::opts_current$get('exercise.serverIP')
  label <- knitr::opts_current$get('label')
  completion <- knitr::opts_current$get('exercise.completion') %||% 1 > 0
  diagnostics <- knitr::opts_current$get('exercise.diagnostics') %||% 1 > 0

  if (!check_empty_value(type) && type != "js") {
    stop("exercise.type can only be 'js' or empty. Problematic chunk with label: \"", label, "\".",
         call. = FALSE)
  }

  # Type 'js', but no caption or id
  if (!check_empty_value(type) && type == "js" && (check_empty_value(caption) || (!check_empty_value(serverIP) && check_empty_value(exerciseId)))) {
    stop("Code chunks with type 'js' must have an `exercise.cap` and an `exercise.id` (if `exercise.serverIP` is defined). Problematic chunk with label: \"", label, "\".",
         call. = FALSE)
  }

  # No type defined or type != "js"
  # Defined: id or serverIP
  if ((check_empty_value(type) || type != "js") && (!check_empty_value(exerciseId) || !check_empty_value(serverIP))) {
    stop("Code chunks with exercise.type empty or not equal to `js` can't have options id and serverIP defined. Problematic chunk with label: \"", label, "\".",
         call. = FALSE)
  }

  # Type 'js' and no serverIP, but caption != "app.js"
  if (!check_empty_value(type) && type == "js" && check_empty_value(serverIP) && caption != "app.js") {
    stop("Code chunks with type 'js' and no JOBE serverIP defined, can only have caption = 'app.js'. Problematic chunk with label: \"", label, "\".",
         call. = FALSE)
  }

  # Type 'js', diagnostics set to FALSE and completion set to TRUE
  if (!check_empty_value(type) && type == "js" && !is.null(diagnostics) && !isTRUE(diagnostics) && (is.null(completion) || isTRUE(completion))) {
    stop("Code chunks with type 'js' can't have `diagnostics` set to FALSE and `completion` set to TRUE. Problematic chunk with label: \"", label, "\".",
         call. = FALSE)
  }

  if (caption == "app.js" && !check_empty_value(exerciseId))
    check_duplicate_file_names(exerciseId)

}

check_duplicate_file_names <- function(exerciseId) {
  exCaptions <- list()
  exLabels <- list()
  # get all knitr chunks
  chunks <- knitr::knit_code$get()
  x <- 1
  for (i in chunks) {
    # Loop through chunks and save those with `exercise.id = exerciseId`
    attr <- attributes(i)
    if (isTRUE(attr$chunk_opts$exercise) && !check_empty_value(attr$chunk_opts$exercise.serverIP) && exerciseId == attr$chunk_opts$exercise.id) {
      exCaptions[x] <- attr$chunk_opts$exercise.cap
      exLabels[x] <- attr$chunk_opts$label
      x <- x + 1
    }
  }

  index <- anyDuplicated(exCaptions)
  if (index != 0)
    stop("Code chunks with exercise.type='js', exercise.serverIP defined and same exercise.id must have unique captions.
          Problematic chunk with exercise.id: \"", exerciseId, "\" and label: \"", exLabels[index], "\".",
         call. = FALSE)
}
