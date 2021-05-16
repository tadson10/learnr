evaluate <- function(code, timelimit) {
  result <- NULL
  code <- paste0('ct <- V8::new_context()\n',
                 'ct$eval(\'', code, '\')')
  # check if RAppArmor is installed,
  a <- installed.packages()
  packages <- a[, 1]
  isInstalled <- is.element("RAppArmor", packages)

  if (is_windows() || is_macos()) {
    setTimeLimit(elapsed = timelimit, transient = TRUE);
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE);
  }
  # execute and capture result
  result <<- tryCatch(
  expr = {
    if (!is_windows() && !is_macos()) {
      # if RAppArmor is installed we can use "r-user" profile for more security
      if (isInstalled)
        unix::eval_safe(code, profile = "r-user", timeout = timelimit, priority = 10, rlimits = c(nproc = 1000, as = 50 * 1024 * 1024 * 1024))
      else
        unix::eval_safe(code, timeout = timelimit, priority = 10, rlimits = c(nproc = 1000, as = 50 * 1024 * 1024 * 1024))
    }
    else
      force(code)
  }
  )
}
# {
#   run_id:"/home/jobe/runs/jobe00_3023_84b71235f753ed19cea11eaff1c9dad1",
#     outcome:12,
#     cmpinfo:"",
#     stdout:"This app is listening on port 3023!",
#     stderr:""
# }
