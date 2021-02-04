
# inline execution evaluator
inline_evaluator <- function(expr, timelimit) {
  print("EVALUATOR: inline_evaluator")
  result <- NULL

  list(
    start = function() {

      # setTimeLimit -- if the timelimit is exceeeded an error will occur
      # during knit which we will catch and format within evaluate_exercise

      # check if RAppArmor is installed, so we can use profile for security reasons
      a <- installed.packages()
      packages <- a[, 1]
      isInstalled <- is.element("RAppArmor", packages)

      if (is_windows() || is_macos() || !isInstalled) {
        setTimeLimit(elapsed = timelimit, transient = TRUE);
        on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE);
      }
      # execute and capture result
      result <<- tryCatch(
        expr = {
        if (!is_windows() && !is_macos()) {
          # if RAppArmor is installed we can use "r-user" profile for more security
          if (isInstalled)
            unix::eval_safe(expr, profile = "r-user", timeout = timelimit, priority = 10, rlimits = c(nproc = 1000, as = 50 * 1024 * 1024 * 1024))
          else
            unix::eval_safe(expr, timeout = timelimit, priority = 10, rlimits = c(nproc = 1000, as = 50 * 1024 * 1024 * 1024))
        }
        else
          force(expr)
      },
       error = function(e) {
        err <- e$message

        #Check for timeout error
        pattern <- gettext("timeout reached", domain = "R")
        if (length(grep(pattern, e$message)) > 0) {
          err <- timeout_error_message()
        }
        error_result(err)
       }
      )
    },

    completed = function() {
      TRUE
    },

    result = function() {
      result
    }
  )
}

# forked execution evaluator
forked_evaluator <- function(expr, timelimit) {
  print("EVALUATOR: forked_evaluator")
  # closure members
  job <- NULL
  start_time <- NULL
  result <- NULL

  # helper to call a hook function
  call_hook <- function(name, default = NULL) {
    hook <- getOption(paste0("tutorial.exercise.evaluator.", name))
    if (!is.null(hook))
      hook(job$pid)
    else if (!is.null(default))
      default(job$pid)
  }

  # default cleanup function
  default_cleanup <- function(pid) {
    print("default_cleanup")
    system(paste("kill -9", pid))
  }

  list(

    start = function() {
      start_time <<- Sys.time()
      job <<- parallel::mcparallel(mc.interactive = FALSE, {

        # close all connections
        closeAllConnections()

        # call onstart hook
        call_hook("onstart")

        # evaluate the expression
        force(expr)
      })
    },

    completed = function() {

      # attempt to collect the result
      collect <- parallel::mccollect(jobs = job, wait = FALSE, timeout = 0.01)

      # got result
      if (!is.null(collect)) {

        # final reaping of process
        parallel::mccollect(jobs = job, wait = FALSE)

        # call cleanup hook
        call_hook("oncleanup", default = default_cleanup)

        # return result
        result <<- collect[[1]]

        # check if it's an error and convert it to an html error if it is
        if (inherits(result, "try-error"))
          result <<- error_result(result)

        TRUE
      }

      # hit timeout
      else if ((Sys.time() - start_time) >= timelimit) {

        # call cleanup hook
        call_hook("oncleanup", default = default_cleanup)

        # return error result
        result <<- error_result(timeout_error_message())
        TRUE
      }

      # not yet completed
      else {
        FALSE
      }
    },

    result = function() {
      result
    }
  )
}
