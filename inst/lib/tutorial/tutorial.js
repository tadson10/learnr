
/* Tutorial construction and initialization */

$(document).ready(function () {
  var tutorial = new Tutorial();

  // register autocompletion if available
  if (typeof TutorialCompleter !== "undefined")
    tutorial.$completer = new TutorialCompleter(tutorial);
  // register diagnostics if available
  if (typeof TutorialDiagnostics !== "undefined")
    tutorial.$diagnostics = new TutorialDiagnostics(tutorial);

  window.tutorial = tutorial;
});

// this var lets us know if the Shiny server is ready to handle http requests
var tutorial_isServerAvailable = false;

function Tutorial() {

  // Alias this
  var thiz = this;

  // Init timing log
  this.$initTimingLog();

  // API: provide init event
  this.onInit = function (handler) {
    this.$initCallbacks.add(handler);
  };

  // API: provide progress events
  this.onProgress = function (handler) {
    this.$progressCallbacks.add(handler);
  };


  // API: Start the tutorial over
  this.startOver = function () {
    thiz.$removeState(function () {
      thiz.$serverRequest("remove_state", null, function () {
        window.location.replace(window.location.origin + window.location.pathname);
      });
    });
  };

  // API: Skip a section
  this.skipSection = function (sectionId) {
    // wait for shiny config to be available (required for $serverRequest)
    if (tutorial_isServerAvailable)
      thiz.$serverRequest("section_skipped", { sectionId: sectionId }, null);
  };

  // API: scroll an element into view
  this.scrollIntoView = function (element) {
    element = $(element);
    var rect = element[0].getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > $(window).height()) {
      if (element[0].scrollIntoView) {
        element[0].scrollIntoView(false);
        document.body.scrollTop += 20;
      }
    }
  };

  // Initialization
  thiz.$initializeVideos();
  thiz.$initializeExercises();
  thiz.$initializeServer();
}

/* Utilities */

Tutorial.prototype.$initTimingLog = function () {
  try {
    if (performance.mark !== undefined) {
      performance.mark("tutorial-start-mark");
    }
  } catch (e) {
    console.log("Error initializing log timing: " + e.message);
  }
};

Tutorial.prototype.$logTiming = function (name) {
  try {
    if (performance.mark !== undefined &&
      performance.measure !== undefined &&
      performance.getEntriesByName !== undefined &&
      this.queryVar('log-timings') === '1') {
      performance.mark(name + "-mark");
      performance.measure(name, "tutorial-start-mark", name + "-mark");
      var entries = performance.getEntriesByName(name);
      console.log("(Timing) " + name + ": " + Math.round(entries[0].duration) + "ms");
    }
  } catch (e) {
    console.log("Error logging timing: " + e.message);
  }
};

Tutorial.prototype.queryVar = function (name) {
  return decodeURI(window.location.search.replace(
    new RegExp("^(?:.*[&\\?]" +
      encodeURI(name).replace(/[\.\+\*]/g, "\\$&") +
      "(?:\\=([^&]*))?)?.*$", "i"),
    "$1"));
};

Tutorial.prototype.$idSelector = function (id) {
  return "#" + id.replace(/(:|\.|\[|\]|,|=|@)/g, "\\$1");
};

// static method to trigger MathJax
Tutorial.triggerMathJax = function () {
  if (window.MathJax) {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
  }
}


/* Init callbacks */
Tutorial.prototype.$initCallbacks = $.Callbacks();

Tutorial.prototype.$fireInit = function () {

  // Alias this
  var thiz = this;

  // fire event
  try {
    thiz.$initCallbacks.fire();
  } catch (e) {
    console.log(e);
  }
};

/* Progress callbacks */

Tutorial.prototype.$progressCallbacks = $.Callbacks();

Tutorial.prototype.$progressEvents = [];

Tutorial.prototype.$hasCompletedProgressEvent = function (element) {
  var thiz = this;
  for (var e = 0; e < thiz.$progressEvents.length; e++) {
    var event = thiz.$progressEvents[e];
    if ($(event.element).is($(element))) {
      if (event.completed)
        return true;
    }
  }
  return false;
};

Tutorial.prototype.$fireProgress = function (event) {

  // record it
  this.$progressEvents.push(event);

  // fire event
  try {
    this.$progressCallbacks.fire(event);
  } catch (e) {
    console.log(e);
  }
};

Tutorial.prototype.$fireSectionCompleted = function (element) {

  // Alias this
  var thiz = this;

  // helper function to fire section completed
  function fireCompleted(el) {
    var event = {
      element: el,
      event: "section_completed"
    };
    thiz.$fireProgress(event);
  }

  // find closest containing section (bail if there is none)
  var section = $(element).parent().closest('.section');
  if (section.length === 0)
    return;

  // get all interactive components in the section
  var components = section.find('.tutorial-exercise, .tutorial-question, .tutorial-video');

  // are they all completed?
  var allCompleted = true;
  for (var c = 0; c < components.length; c++) {
    var component = components.get(c);
    if (!thiz.$hasCompletedProgressEvent(component)) {
      allCompleted = false;
      break;
    }
  }

  // if they are then fire event
  if (allCompleted) {

    // fire the event
    fireCompleted($(section).get(0));

    // fire for preceding siblings if they have no interactive components
    var previousSections = section.prevAll('.section');
    previousSections.each(function () {
      var components = $(this).find('.tutorial-exercise, .tutorial-question');
      if (components.length === 0)
        fireCompleted(this);
    });

    // if there is another section above us then process it
    var parentSection = section.parent().closest('.section');
    if (parentSection.length > 0)
      this.$fireSectionCompleted(section);
  }
};

Tutorial.prototype.$removeConflictingProgressEvents = function (progressEvent) {
  // Alias this
  var thiz = this;
  var event;
  // work backwords as to avoid skipping a position caused by removing an element
  for (var i = thiz.$progressEvents.length - 1; i >= 0; i--) {
    event = thiz.$progressEvents[i];
    if (event.event === "question_submission") {
      if (
        event.data.label === progressEvent.data.label &
        progressEvent.data.label !== undefined
      ) {
        // remove the item from existing progress events
        thiz.$progressEvents.splice(i, 1)
        return;
      }
    }
  }
}


Tutorial.prototype.$fireProgressEvent = function (event, data) {

  // Alias this
  var thiz = this;

  // progress event to fire
  var progressEvent = { event: event, data: data };

  // determine element and completed status
  if (event == "exercise_submission" || event == "question_submission") {
    var element = $('.tutorial-exercise[data-label="' + data.label + '"]').add(
      '.tutorial-question[data-label="' + data.label + '"]');
    if (element.length > 0) {
      progressEvent.element = element;
      if (event == "exercise_submission") {
        // any progress event for an exercise is to complete only
        progressEvent.completed = true;
      } else {
        // question_submission
        // questions may be reset with "try again", and not in a completed state
        progressEvent.completed = (data.answer !== null);
      }
    }

  }
  else if (event == "section_skipped") {
    var exerciseElement = $(thiz.$idSelector(data.sectionId));
    progressEvent.element = exerciseElement;
    progressEvent.completed = false;
  }
  else if (event == "video_progress") {
    var videoElement = $('iframe[src="' + data.video_url + '"]');
    if (videoElement.length > 0) {
      progressEvent.element = videoElement;
      progressEvent.completed = (2 * data.time) > data.total_time;
    }
  }

  // remove any prior forms of this progressEvent
  this.$removeConflictingProgressEvents(progressEvent)

  // fire it if we found an element
  if (progressEvent.element) {

    // fire event
    this.$fireProgress(progressEvent);

    // synthesize higher level section completed events
    thiz.$fireSectionCompleted(progressEvent.element);
  }
};

Tutorial.prototype.$initializeProgress = function (progress_events) {

  // Alias this
  var thiz = this;

  // replay progress messages from previous state
  for (var i = 0; i < progress_events.length; i++) {

    // get event
    var progress = progress_events[i];
    var progressEvent = progress.event;

    // determine data
    var progressEventData = {};
    if (progressEvent == "exercise_submission") {
      progressEventData.label = progress.data.label;
      progressEventData.correct = progress.data.correct;
    }
    else if (progressEvent == "question_submission") {
      progressEventData.label = progress.data.label;
      progressEventData.answer = progress.data.answer;
    }
    else if (progressEvent == "section_skipped") {
      progressEventData.sectionId = progress.data.sectionId;
    }
    else if (progressEvent == "video_progress") {
      progressEventData.video_url = progress.data.video_url;
      progressEventData.time = progress.data.time;
      progressEventData.total_time = progress.data.total_time;
    }

    thiz.$fireProgressEvent(progressEvent, progressEventData);
  }

  // handle susequent progress messages
  Shiny.addCustomMessageHandler("tutorial.progress_event", function (progress) {
    thiz.$fireProgressEvent(progress.event, progress.data);
  });
};


/* Shared utility functions */

Tutorial.prototype.$serverRequest = function (type, data, success, error) {
  return $.ajax({
    type: "POST",
    url: "session/" + Shiny.shinyapp.config.sessionId +
      "/dataobj/" + type + "?w=" + Shiny.shinyapp.config.workerId,
    contentType: "application/json",
    data: JSON.stringify(data),
    dataType: "json",
    success: success,
    error: error
  });
};

// Record an event
Tutorial.prototype.$recordEvent = function (label, event, data) {
  var params = {
    label: label,
    event: event,
    data: data
  };
  this.$serverRequest("record_event", params, null);
};


Tutorial.prototype.$countLines = function (str) {
  return str.split(/\r\n|\r|\n/).length;
};


Tutorial.prototype.$injectScript = function (src, onload) {
  var script = document.createElement('script');
  script.src = src;
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
  $(script).on("load", onload);
};

Tutorial.prototype.$debounce = function (func, wait, immediate) {
  var timeout;
  return function () {
    var context = this, args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};



/* Videos */

Tutorial.prototype.$initializeVideos = function () {

  // regexes for video types
  var youtubeRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var vimeoRegex = /(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i;

  // check a url for video typtes
  function isYouTubeVideo(src) {
    return src.match(youtubeRegex);
  }
  function isVimeoVideo(src) {
    return src.match(vimeoRegex);
  }
  function isVideo(src) {
    return isYouTubeVideo(src) || isVimeoVideo(src);
  }

  // function to normalize a video src url (web view -> embed)
  function normalizeVideoSrc(src) {

    // youtube
    var youtubeMatch = src.match(youtubeRegex);
    if (youtubeMatch)
      return "https://www.youtube.com/embed/" + youtubeMatch[2] + "?enablejsapi=1";

    // vimeo
    var vimeoMatch = src.match(vimeoRegex);
    if (vimeoMatch)
      return "https://player.vimeo.com/video/" + vimeoMatch[1];

    // default to reflecting src back
    return src;
  }

  // function to set the width and height for the container conditioned on
  // any user-specified height and width
  function setContainerSize(container, width, height) {

    // default ratio
    var aspectRatio = 9 / 16;

    // default width to 100% if not specified
    if (!width)
      width = "100%";

    // percentage based width
    if (width.slice(-1) == "%") {

      container.css('width', width);
      if (!height) {
        height = 0;
        var paddingBottom = (parseFloat(width) * aspectRatio) + '%';
        container.css('padding-bottom', paddingBottom);
      }
      container.css('height', height);
    }
    // other width unit
    else {
      // add 'px' if necessary
      if ($.isNumeric(width))
        width = width + "px";
      container.css('width', width);
      if (!height)
        height = (parseFloat(width) * aspectRatio) + 'px';
      container.css('height', height);
    }
  }

  // inspect all images to see if they contain videos
  $("img").each(function () {

    // skip if this isn't a video
    var videoSrc = $(this).attr('src');
    if (!isVideo(videoSrc))
      return;

    // hide while we process
    $(this).css('display', 'none');

    // collect various attributes
    var width = $(this).get(0).style.width;
    var height = $(this).get(0).style.height;
    $(this).css('width', '').css('height', '');
    var attrs = {};
    $.each(this.attributes, function (idex, attr) {
      if (attr.nodeName == "width")
        width = String(attr.nodeValue);
      else if (attr.nodeName == "height")
        height = String(attr.nodeValue);
      else if (attr.nodeName == "src")
        attrs.src = normalizeVideoSrc(attr.nodeValue);
      else
        attrs[attr.nodeName] = attr.nodeValue;
    });

    // replace the image with the iframe inside a video container
    $(this).replaceWith(function () {
      var iframe = $('<iframe/>', attrs);
      iframe.addClass('tutorial-video');
      if (isYouTubeVideo(videoSrc))
        iframe.addClass('tutorial-video-youtube');
      else if (isVimeoVideo(videoSrc))
        iframe.addClass('tutorial-video-vimeo');
      iframe.attr('allowfullscreen', '');
      iframe.css('display', '');
      var container = $('<div class="tutorial-video-container"></div>');
      setContainerSize(container, width, height);
      container.append(iframe);
      return container;
    });
  });

  // we'll initialize video player APIs off of $restoreState
  this.$logTiming("initialized-videos");
};

Tutorial.prototype.$initializeVideoPlayers = function (video_progress) {

  // don't interact with video player APIs in Qt
  if (/\bQt\//.test(window.navigator.userAgent))
    return;

  this.$initializeYouTubePlayers(video_progress);
  this.$initializeVimeoPlayers(video_progress);

};

Tutorial.prototype.$videoPlayerRestoreTime = function (src, video_progress) {

  // find a restore time for this video
  for (var v = 0; v < video_progress.length; v++) {
    var id = video_progress[v].id;
    if (src == id) {
      var time = video_progress[v].data.time;
      var total_time = video_progress[v].data.total_time;
      // don't return a restore time if we are within 10 seconds of the beginning
      // or the end of the video.
      if (time > 10 && ((total_time - time) > 10))
        return time;
    }
  }

  // no time to restore, return 0
  return 0;
};

Tutorial.prototype.$initializeYouTubePlayers = function (video_progress) {

  // YouTube JavaScript API
  // https://developers.google.com/youtube/iframe_api_reference

  // alias this
  var thiz = this;

  // attach to youtube videos
  var videos = $('iframe.tutorial-video-youtube');
  if (videos.length > 0) {
    this.$injectScript('https://www.youtube.com/iframe_api', function () {

      YT.ready(function () {

        videos.each(function () {

          // video and player
          var video = $(this);
          var videoUrl = video.attr('src');
          var player = null;
          var lastState = -1;

          // helper to report progress to the server
          function reportProgress() {
            thiz.$reportVideoProgress(videoUrl,
              player.getCurrentTime(),
              player.getDuration());
          }

          // helper to restore video time. attempt to restore to 10 seconds prior
          // to the last save point (to recapture frame of reference)
          function restoreTime() {
            var restoreTime = thiz.$videoPlayerRestoreTime(videoUrl, video_progress);
            if (restoreTime > 0) {
              player.mute();
              player.playVideo();
              setTimeout(function () {
                player.pauseVideo();
                player.seekTo(restoreTime, true);
                player.unMute();
              }, 2000);
            }
          }

          // function to call onReady
          function onReady() {
            restoreTime();
          }

          // function to call on state changed
          function onStateChange() {

            // get current state
            var state = player.getPlayerState();

            // don't report for unstarted & queued
            if (state == -1 || state == YT.PlayerState.CUED) {

            }

            // always report progress for playing
            else if (state == YT.PlayerState.PLAYING) {
              reportProgress();
            }

            // report for other states as long as they aren't duplicates
            else if (state != lastState) {
              reportProgress();
            }

            // update last state
            lastState = state;
          }

          // create the player
          player = new YT.Player(this, {
            events: {
              'onReady': onReady,
              'onStateChange': onStateChange
            }
          });

          // poll for state change every 5 seconds
          window.setInterval(onStateChange, 5000);
        });
      });
    });
  }
};

Tutorial.prototype.$initializeVimeoPlayers = function (video_progress) {

  // alias this
  var thiz = this;

  // Vimeo JavaScript API
  // https://github.com/vimeo/player.js

  var videos = $('iframe.tutorial-video-vimeo');
  if (videos.length > 0) {
    this.$injectScript('https://player.vimeo.com/api/player.js', function () {
      videos.each(function () {

        // video and player
        var video = $(this)
        var videoUrl = video.attr('src');
        var player = new Vimeo.Player(this);
        var lastReportedTime = null;

        // restore time if we can
        player.ready().then(function () {
          var restoreTime = thiz.$videoPlayerRestoreTime(videoUrl, video_progress);
          if (restoreTime > 0) {
            player.getVolume().then(function (volume) {
              player.setCurrentTime(restoreTime).then(function () {
                player.pause().then(function () {
                  player.setVolume(volume);
                });
              });
            });
          }
        });

        // helper function to report progress
        function reportProgress(data, throttle) {

          // default throttle to false
          if (throttle === undefined)
            throttle = false;

          // if we are throttling then don't report if the last
          // reported time is within 5 seconds
          if (throttle && (lastReportedTime != null) &&
            ((data.seconds - lastReportedTime) < 5)) {
            return;
          }

          // report progress
          thiz.$reportVideoProgress(videoUrl, data.seconds, data.duration);
          lastReportedTime = data.seconds;
        }

        // report progress on various events
        player.on('play', reportProgress);
        player.on('pause', reportProgress);
        player.on('ended', reportProgress);
        player.on('timeupdate', function (data) {
          reportProgress(data, true);
        });
      });
    });
  }
};

Tutorial.prototype.$reportVideoProgress = function (video_url, time, total_time) {
  this.$serverRequest("video_progress", {
    "video_url": video_url,
    "time": time,
    "total_time": total_time
  });
};


/* Exercise initialization and shared utility functions */

Tutorial.prototype.$initializeExercises = function () {

  this.$initializeExerciseEditors();
  this.$initializeExerciseSolutions();
  this.$initializeExerciseEvaluation();

  this.$logTiming("initialized-exercises");

  // Get ApiKey from local storage and fill all inputs with it
  fillInputsWithApiKey();
  // Simulate click on first tab for every JS exercise
  openFirstTab();

  // Prevent favicon error
  $(document.getElementsByTagName('head')[0]).append($(`<link rel="shortcut icon" href="#">`));
};

Tutorial.prototype.$exerciseForLabel = function (label) {
  return $('.tutorial-exercise[data-label="' + label + '"]');
};

Tutorial.prototype.$forEachExercise = function (operation) {
  return $(".tutorial-exercise").each(function () {
    var exercise = $(this);
    operation(exercise);
  });
};

Tutorial.prototype.$exerciseSupportCode = function (label) {
  var selector = '.tutorial-exercise-support[data-label="' + label + '"]';
  var code = $(selector).children('pre').children('code');
  if (code.length > 0)
    return code.text();
  else
    return null;
};

Tutorial.prototype.$exerciseSolutionCode = function (label) {
  return this.$exerciseSupportCode(label + "-solution");
};

Tutorial.prototype.$exerciseCheckCode = function (label) {
  return this.$exerciseSupportCode(label + "-check");
};

Tutorial.prototype.$exerciseHintDiv = function (label) {

  // look for a div w/ hint id
  var id = "section-" + label + "-hint";
  var hintDiv = $('div#' + id);

  // ensure it isn't a section then return
  if (hintDiv.length > 0 && !hintDiv.hasClass('section'))
    return hintDiv;
  else
    return null;
};

Tutorial.prototype.$exerciseHintsCode = function (label) {

  // look for a single hint
  var hint = this.$exerciseSupportCode(label + "-hint");
  if (hint !== null)
    return [hint];

  // look for a sequence of hints
  var hints = [];
  var index = 1;
  while (true) {
    var hintLabel = label + "-hint-" + index++;
    hint = this.$exerciseSupportCode(hintLabel);
    if (hint !== null)
      hints.push(hint);
    else
      break;
  }

  // return what we have (null if empty)
  if (hints.length > 0)
    return hints;
  else
    return null;
};

// get the exercise container of an element
Tutorial.prototype.$exerciseContainer = function (el) {
  return $(el).closest(".tutorial-exercise");
};

// show progress for exercise
Tutorial.prototype.$showExerciseProgress = function (label, button, show) {

  // references to various UI elements
  var exercise = this.$exerciseForLabel(label);
  if (exercise.attr("data-serverIP") == "") {
    var outputFrame = exercise.children('.tutorial-exercise-output-frame');
    var runButtons = exercise.find('.btn-tutorial-run');

    // if the button is "run" then use the run button
    if (button === "run")
      button = exercise.find('.btn-tutorial-run').last();

    // show/hide progress UI
    var spinner = 'fa-spinner fa-spin fa-fw';
    if (show) {
      outputFrame.addClass('recalculating');
      runButtons.addClass('disabled');
      if (button !== null) {
        var runIcon = button.children('i');
        runIcon.removeClass(button.attr('data-icon'));
        runIcon.addClass(spinner);
      }
    }
    else {
      outputFrame.removeClass('recalculating');
      runButtons.removeClass('disabled');
      runButtons.each(function () {
        var button = $(this);
        var runIcon = button.children('i');
        runIcon.addClass(button.attr('data-icon'));
        runIcon.removeClass(spinner);
      });
    }
  }
};


// behavior constants
Tutorial.prototype.kMinLines = 3;

// edit code within an ace editor
Tutorial.prototype.$attachAceEditor = function (target, code) {
  var mode = "r";
  var editor = ace.edit(target);

  var exercise = this.$exerciseContainer(editor.container);
  var type = exercise.attr("data-type");
  var completion = exercise.attr("data-completion");
  var diagnostics = exercise.attr("data-diagnostics");
  if (type == "js") {
    var fileExt = exercise.attr("data-caption").split(".")[1];
    switch (fileExt) {
      case "js":
        mode = "javascript";
        break;
      default:
        mode = fileExt;
        break;
    }
  }

  editor.setHighlightActiveLine(false);
  editor.setShowPrintMargin(false);
  editor.setShowFoldWidgets(false);
  editor.setBehavioursEnabled(true);
  editor.renderer.setDisplayIndentGuides(false);
  editor.setTheme("ace/theme/textmate");
  editor.$blockScrolling = Infinity;
  if (type != 'js' || diagnostics > 0)
    editor.session.setMode("ace/mode/" + mode);
  editor.session.getSelection().clearSelection();
  editor.setValue(code, -1);

  if (type == "js" && completion > 0) {
    editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });
  }
  return editor;
};


/* Exercise editor */

Tutorial.prototype.$exerciseEditor = function (label) {
  return this.$exerciseForLabel(label).find('.tutorial-exercise-code-editor');
};


Tutorial.prototype.$initializeExerciseEditors = function () {

  // alias this
  var thiz = this;

  this.$forEachExercise(function (exercise) {

    // capture label and caption
    var label = exercise.attr('data-label');
    var caption = exercise.attr('data-caption'); // With data-type="js" represents file name
    var exerciseType = exercise.attr('data-type'); // Type of exercise (set to "r" when left empty) - special behaviour when = "js"
    var serverIP = exercise.attr('data-serverIP'); // IP of JOBE server for JS code execution - when empty code is executed at client side
    var exerciseName = exercise.attr('data-id'); // Name of exercise - used for JS to join files that belong to same exercise into TABS

    // helper to create an id
    function create_id(suffix) {
      return "tutorial-exercise-" + label + "-" + suffix;
    }

    // when we receive focus hide solutions in other exercises
    exercise.on('focusin', function () {
      $('.btn-tutorial-solution').each(function () {
        if (exercise.has($(this)).length === 0)
          thiz.$removeSolution(thiz.$exerciseContainer($(this)));
      });
    });

    // get all <pre class='text'> elements, get their code, then remove them
    var code = '';
    var code_blocks = exercise.children('pre.text, pre.lang-text');
    code_blocks.each(function () {
      var code_element = $(this).children('code');
      if (code_element.length > 0)
        code = code + code_element.text();
      else
        code = code + $(this).text();
    });
    code_blocks.remove();
    // ensure a minimum of 3 lines
    var lines = code.split(/\r\n|\r|\n/).length;
    for (var i = lines; i < thiz.kMinLines; i++)
      code = code + "\n";


    // get the knitr options script block and detach it (will move to input div)
    var options_script = exercise.children('script[data-opts-chunk="1"]').detach();

    // wrap the remaining elements in an output frame div
    exercise.wrapInner('<div class="tutorial-exercise-output-frame"></div>');
    var output_frame = exercise.children('.tutorial-exercise-output-frame');

    // create input div
    var input_div = $('<div class="tutorial-exercise-input panel panel-default"></div>');
    input_div.attr('id', create_id('input'));

    /********************************************* */
    var isExerciseJS = exerciseType == "js";
    var isAppJS = caption == 'app.js' && isExerciseJS;
    if (isAppJS && serverIP != "")
      addApiKeyAndFirstTab(exerciseName, label);
    else if (!isAppJS && isExerciseJS && serverIP != "")
      addFileTab(exerciseName, caption, label, serverIP);
    /********************************************* */

    // creating heading
    if (isExerciseJS)
      var panel_heading = $('<div class="toolbar panel-heading tutorial-panel-heading"></div>');
    else
      var panel_heading = $('<div class="panel-heading tutorial-panel-heading"></div>');

    panel_heading.text(caption);
    input_div.append(panel_heading);

    // create body
    var panel_body = $('<div class="panel-body"></div>');
    input_div.append(panel_body);


    // function to add a submit button
    function add_submit_button(icon, style, text, check, isRunButton, onClick) {
      var runClass = "";
      // class that tells inputBinding to bind this button
      if (isRunButton)
        runClass = "btn-tutorial-run";

      var button = $(`<a ${onClick} class="btn ${style} btn-xs ${runClass} pull-right"></a>`);
      button.append($('<i class="fa ' + icon + '"></i>'));
      button.attr('type', 'button');
      button.append(' ' + text);

      var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      var title = text;
      if (!check && text == 'Run code')
        title = title + " (" + (isMac ? "Cmd" : "Ctrl") + "+Shift+Enter)";
      button.attr('title', title);
      if (check)
        button.attr('data-check', '1');
      button.attr('data-icon', icon);


      button.on('click', function () {

        // When exercise is NOT JS
        // When exersise IS JS and
        //       - JOBE server IP is defined and button text is "Send file"
        //       - JOBE server IP is NOT defined and button text is "Run code"
        if (!isExerciseJS || (isExerciseJS && ((serverIP != "" && text == 'Send file') || (serverIP == "" && text == 'Run code')))) {
          thiz.$removeSolution(exercise);
          if (serverIP == "") //to add/remove spinner from button
            thiz.$showExerciseProgress(label, button, true);
        }
      });

      panel_heading.append(button);
      return button;
    }




    // create submit answer button if checks are enabled
    if (thiz.$exerciseCheckCode(label) !== null)
      add_submit_button("fa-check-square-o", "btn-primary", "Submit Answer", true, true, "");

    // create run button
    // in JS exercises only app.js file has "Run code" button
    if (!isExerciseJS || isAppJS) {
      var run_button;
      var onClick = "";
      var isRunButton = true;
      if (isAppJS && serverIP != "") {
        isRunButton = false;
        onClick = `onclick="runJSCode(this, '${serverIP}')"`;
      }
      run_button = add_submit_button("fa-play", "btn-success", "Run code", false, isRunButton, onClick);
    }

    // If it is JS exercise, we add 3 more buttons
    if (isExerciseJS && serverIP != "") {
      var onClick;
      if (isAppJS) {
        onClick = `onclick="stopExecution(this, '${serverIP}')"`;
        add_submit_button("fa-stop", "btn-success", "Stop", false, false, onClick);
      }

      onClick = `onclick="sendFile(this, '${caption}', '${serverIP}', '${label}')"`;
      add_submit_button("fa-floppy-o", "btn-success", "Send file", false, true, onClick);

      if (isAppJS) {
        onClick = `onclick="sendAllFiles('${exerciseName}')"`;
        add_submit_button("fa-floppy-o", "btn-success", "Send all", false, false, onClick);
      }

      if (isAppJS) {
        onClick = `onclick="getFreePort(this, '${serverIP}')"`;
        add_submit_button("fa-search", "btn-success", "Authenticate", false, false, onClick);
      }
    }

    // create code div and add it to the input div
    var code_div = $('<div class="tutorial-exercise-code-editor"></div>');
    // If it is JS exercise
    if (isExerciseJS)
      code_div = $(`<div class="tutorial-exercise-code-editor"></div>`);

    var code_id = create_id('code-editor');
    code_div.attr('id', code_id);
    panel_body.append(code_div);

    // add the knitr options script to the input div
    panel_body.append(options_script);

    // prepend the input div to the exercise container
    exercise.prepend(input_div);

    // create an output div and append it to the output_frame
    var output_div = $('<div class="tutorial-exercise-output"></div>');
    output_div.attr('id', create_id('output'));
    output_frame.append(output_div);

    if (isAppJS && serverIP != "") {
      addOutputTabs(exerciseName, label, serverIP);
      var error_div = $(`<div class="tutorial-exercise-error">
                        <pre><code></code></pre>
                        </div>`);
      output_frame.after(error_div);

      var webpage_div = $(`<div class="webpageDiv">
                          <iframe class="webpage" width="100%" height="600" loading="lazy"></iframe></div>`);
      output_frame.after(webpage_div);

      var server_output_div = $(`<div class="tutorial-exercise-server-output">
                                  <pre><code></code></pre>
                                </div>`);
      output_frame.after(server_output_div);
    }


    // activate the ace editor
    var editor = thiz.$attachAceEditor(code_id, code);

    // get setup_code (if any)
    var setup_code = null;
    var chunk_options = options_script.length == 1 ? JSON.parse(options_script.text()) : {};
    if (chunk_options["exercise.setup"])
      setup_code = thiz.$exerciseSupportCode(chunk_options["exercise.setup"]);
    else
      setup_code = thiz.$exerciseSupportCode(label + "-setup");

    // use code completion
    var completion = exercise.attr('data-completion') === "1";
    var diagnostics = exercise.attr('data-diagnostics') === "1";

    // support startover
    var startover_code = exercise.attr('data-startover') === "1" ? code : null;


    // set tutorial options/data
    editor.tutorial = {
      label: label,
      setup_code: setup_code,
      completion: completion,
      diagnostics: diagnostics,
      startover_code: startover_code
    };

    // bind execution keys
    function bindExecutionKey(name, key) {
      var macKey = key.replace("Ctrl+", "Command+");
      editor.commands.addCommand({
        name: name,
        bindKey: { win: key, mac: macKey },
        exec: function (editor) {
          run_button.trigger('click');
        }
      });
    }
    bindExecutionKey("execute1", "Ctrl+Enter");
    bindExecutionKey("execute2", "Ctrl+Shift+Enter");


    // re-focus the editor on run button click
    // Only for app.js and non-JS exercises
    if (isAppJS || !isExerciseJS)
      run_button.on('click', function () {
        editor.focus();
      });

    // mange ace height as the document changes
    var updateAceHeight = function () {
      var lines = exercise.attr('data-lines');
      if (lines && (lines > 0)) {
        editor.setOptions({
          minLines: lines,
          maxLines: lines
        });
      } else {
        editor.setOptions({
          minLines: thiz.kMinLines,
          maxLines: Math.max(Math.min(editor.session.getLength(), 15),
            thiz.kMinLines)
        });
      }

    };
    updateAceHeight();
    editor.getSession().on('change', updateAceHeight);

    // add hint/solution/startover buttons if necessary
    thiz.$addSolution(exercise, panel_heading, editor);

    exercise.parents('.section').on('shown', function () {
      editor.resize(true);
    });
  });
};

var sendAllFiles = function (exerciseName) {
  // We get reservation data from local storage and we pass them with request
  var apiKey = window.localStorage.getItem("apiKey");
  var credentials = window.localStorage.getItem("credentials");
  if (credentials == null || apiKey == null) {
    bootbox.alert("Before you can send files, you need to authenticate.");
    return;
  }

  // get all files for sthis exercise
  var files = $('[data-id="' + exerciseName + '"]');
  for (var i = 0; i < files.length; i++) {
    var button = $(files[i].getElementsByClassName("btn-tutorial-run"))[0];
    button.click();
  }
}

var sendFile = function (button, fileName, serverIP, label) {
  // We get reservation data from local storage and we pass them with request
  var apiKey = window.localStorage.getItem("apiKey");
  var credentials = window.localStorage.getItem("credentials");
  if (credentials == null || apiKey == null) {
    bootbox.alert("Before you can send file, you need to authenticate.");
    return;
  }

  var editor = ace.edit(`tutorial-exercise-${label}-code-editor`);
  var code = editor.getSession().getValue();

  // Regex to remove comments from code - we don't need to check comments for the right PORT
  var uncomment = /((\/\*[\s\S]*?\*\/|\/\/.*))/g;
  var codeUncomment = code.replace(uncomment, '');

  // Check if user tried to start server on other ports that don't belong to him
  // First we check if user tried to start a server
  var regServer = /[.]listen/g;
  var match1 = codeUncomment.match(regServer);
  if (match1 && match1.length > 0) {
    // we check that 'process.env.PORT' is used for port number
    var regPort = /[.]listen\s*\(\s*process.env.PORT/g;
    var match2 = codeUncomment.match(regPort);
    // Check if after every '.listen', 'process.env.PORT' is used
    if (!match2 || match2.length != match1.length) {
      bootbox.alert("You can only use 'process.env.PORT' to start server!");
      return;
    }
  }

  var body = JSON.parse(credentials)
  if (body != null)
    body.file_contents = btoa(unescape(encodeURIComponent(code)));

  // Add spinner to button
  var spinner = 'fa-spinner fa-spin fa-fw';
  var runIcon = button.children[0];
  buttonExecutionStart(button, runIcon, spinner);

  // Make request
  var xhr = new XMLHttpRequest();
  xhr.open("PUT", 'http://' + serverIP + '/jobe/index.php/restapi/file/' + fileName, true);

  //Send the proper header information along with the request
  xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");

  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE) {
      buttonExecutionEnd(button, runIcon, spinner);
      // We got response from JOBE sandbox
      if (xhr.responseText) {
        // Request finished. Do processing here.
        var response = JSON.parse(this.responseText);
        // Show error response to user
        response = response.error == undefined ? response : response.error;
        if (this.status != 201)
          bootbox.alert(response);
        else
          changeBtnColor(button);
      }
      else
        bootbox.alert("JOBE sandbox is not available at the moment! Try again later!");
    }
  }

  xhr.setRequestHeader("X-API-KEY", apiKey);
  xhr.send(JSON.stringify(body));
}

var runJSCode = function (button, serverIP) {
  // We get reservation data from local storage and we pass them with request
  var apiKey = window.localStorage.getItem("apiKey");
  var credString = window.localStorage.getItem("credentials");
  var credentials = JSON.parse(credString);
  if (credString == null || apiKey == null) {
    bootbox.alert("Before you can send file, you need to authenticate.");
    return;
  }

  // Add spinner to button
  var spinner = 'fa-spinner fa-spin fa-fw';
  var runIcon = button.children[0];
  buttonExecutionStart(button, runIcon, spinner);

  // Remove output and error fields
  var exercise = $($(button).closest(".tutorial-exercise"))[0];
  var error = exercise.getElementsByClassName("tutorial-exercise-error")[0].getElementsByTagName("code")[0];
  var output = exercise.getElementsByClassName("tutorial-exercise-server-output")[0].getElementsByTagName("code")[0];
  error.innerHTML = "";
  output.innerHTML = "";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", 'http://' + serverIP + '/jobe/index.php/restapi/runs', true);

  //Send the proper header information along with the request
  xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");

  xhr.onreadystatechange = function () { // Call a function when the state changes.
    if (this.readyState === XMLHttpRequest.DONE) {
      buttonExecutionEnd(button, runIcon, spinner);
      if (xhr.responseText) {
        // Request finished. Do processing here.
        var response = JSON.parse(this.responseText);

        // Show output to user
        output.innerHTML = response.stdout;
        response = response.error == undefined ? response : response.error;

        // Error occurred
        if (this.status != 200)
          bootbox.alert(response);
        else {
          // Show error to user
          var regTerminated = /\/var\/www\/html\/jobe\/application\/libraries\/..\/..\/runguard\/runguard: warning: command terminated with signal 9/g;
          var match = response.stderr.match(regTerminated);
          if (match && match.length == 1)
            error.innerHTML = 'Execution stoppped.';
          else
            error.innerHTML = response.stderr;
        }
      }
      else
        bootbox.alert("JOBE sandbox is not available at the moment! Try again later!");
    }
  }

  // Get timelimit for execution on JOBE server
  var timelimit = JSON.parse(exercise.getElementsByClassName("panel-body")[0].getElementsByTagName("script")[0].innerHTML)["exercise.timelimit"];
  var body = {
    "run_spec": {
      "language_id": "nodejs",
      "sourcefilename": "app.js",
      "parameters": {
        "cputime": timelimit ? timelimit : 10
      }
    }
  };

  if (credentials != null)
    jQuery.extend(body.run_spec, credentials);

  xhr.setRequestHeader("X-API-KEY", apiKey);
  xhr.send(JSON.stringify(body));
}

function buttonExecutionStart(button, runIcon, spinner) {
  // Add spinner and disable button
  $(runIcon).removeClass(button.getAttribute('data-icon'));
  $(runIcon).addClass(spinner);
  $(button).addClass('disabled');
}

function buttonExecutionEnd(button, runIcon, spinner) {
  // Button to initial state
  $(runIcon).removeClass(spinner);
  $(button).removeClass('disabled');
  $(runIcon).addClass(button.getAttribute('data-icon'));
}

// Stop execution
function stopExecution(button, serverIP) {
  // We get reservation data from local storage and we pass them with request
  var apiKey = window.localStorage.getItem("apiKey");
  var credentials = window.localStorage.getItem("credentials");
  if (credentials == null || apiKey == null) {
    bootbox.alert("Before you can send file, you need to authenticate.");
    return;
  }

  // Add spinner and disable button
  var spinner = 'fa-spinner fa-spin fa-fw';
  var runIcon = button.children[0];
  buttonExecutionStart(button, runIcon, spinner);

  var xhttp = new XMLHttpRequest();

  // Wait for the answer
  xhttp.onreadystatechange = function () {
    if (this.readyState == 4) {
      // Button to initial state
      buttonExecutionEnd(button, runIcon, spinner);

      // We got response from JOBE sandbox
      if (xhttp.responseText) {
        var response = JSON.parse(this.responseText);
        response = response.error == undefined ? response : response.error;
        // Error occurred
        if (this.status != 200)
          bootbox.alert(response);
      }
      else {
        bootbox.alert("JOBE sandbox is not available at the moment! Try again later!");
      }

    }
  }

  xhttp.open("POST", "http://" + serverIP + "/jobe/index.php/restapi/stop", true);
  xhttp.setRequestHeader("Content-Type", "application/json");
  xhttp.setRequestHeader("X-API-KEY", apiKey);
  xhttp.send(credentials);
}

var getFreePort = function (button, serverIP) {
  var apiKey = window.localStorage.getItem("apiKey");
  if (apiKey == null) {
    bootbox.alert("API KEY is missing!");
    return;
  }

  // Add spinner and disable button
  var spinner = 'fa-spinner fa-spin fa-fw';
  var runIcon = button.children[0];
  buttonExecutionStart(button, runIcon, spinner);

  var xhttp = new XMLHttpRequest();

  // Wait for the answer
  xhttp.onreadystatechange = function () {
    // We get FREE PORT
    if (this.readyState == 4) {
      var toolbar = button.parentElement;

      // Delete element with port if it exists
      var list = document.getElementsByClassName("portNumber");
      var listLength = list.length;
      for (var i = 0; i < listLength; i++)
        list[0].parentNode.removeChild(list[0]);

      // Button to initial state
      buttonExecutionEnd(button, runIcon, spinner);

      // We got response from JOBE sandbox
      if (xhttp.responseText) {
        // We don't get free port - all ports are used

        if (this.status != 200) {
          var message = JSON.parse(xhttp.responseText);
          message = message.error == undefined ? message : message.error;
          if (this.status == 403)
            alert(message.error);
          else
            alert(message);
        }
        // We get FREE PORT
        else {
          var port = JSON.parse(xhttp.responseText).port;
          var jobeUser = JSON.parse(xhttp.responseText).jobeUser;
          var randomValue = JSON.parse(xhttp.responseText).randomValue;

          addPortToLocalStorage(port, jobeUser, randomValue);
          changeBtnColor(button);
        }
      }
      else {
        bootbox.alert("JOBE sandbox is not available at the moment! Try again later!");
      }
    }
  };


  // We get reservation data from local storage and we pass them with request
  var apiKey = window.localStorage.getItem("apiKey");

  xhttp.open("GET", "http://" + serverIP + "/jobe/index.php/restapi/free_ports", true);
  xhttp.setRequestHeader("Content-Type", "application/json");
  xhttp.setRequestHeader("X-API-KEY", apiKey);
  xhttp.send();
}

function changeBtnColor(button) {
  button.style.backgroundColor = "#4CAF50";
  setTimeout(function () { button.style = null; }, 3000);
}

// Function to change theme for all editors
function changeTheme(theme) {
  var editorDivs = document.getElementsByClassName("tutorial-exercise-code-editor");
  for (var i = 0; i < editorDivs.length; i++) {
    var editor = ace.edit(editorDivs[i].id);
    editor.setTheme("ace/theme/" + theme);
  }
}

// Add HTML element for PORT to all file toolbars
function addPortHtml() {
  // Check if we already have PORT in local storage
  var credentials = window.localStorage.getItem("credentials");
  if (credentials != null) {
    var port = JSON.parse(credentials).port;

    // Find all files and add PORT HTML element
    var toolbars = document.getElementsByClassName("toolbar");
    for (var i = 0; i < toolbars.length; i++) {
      // We add HTML element with PORT
      var htmlPort = document.createElement("span");
      htmlPort.innerHTML = "PORT: " + port;
      htmlPort.className = "pull-right portNumber";
      htmlPort.id = "portNumber";

      var toolbar = toolbars[i];
      toolbar.appendChild(htmlPort);
    }
  }
}

function addPortToLocalStorage(port, jobeUser, randomValue) {
  var objStorage = {
    jobeUser: jobeUser,
    port: port,
    randomValue: randomValue
  };
  window.localStorage.setItem('credentials', JSON.stringify(objStorage));
}

// Get ApiKey from local storage and fill all inputs with it
function fillInputsWithApiKey() {
  var apiKey = window.localStorage.getItem("apiKey");

  // Api key is saved in local storage
  if (apiKey != null) {
    // Set api key to all inputs
    var allApiKeyInputs = document.getElementsByClassName("apiKey");
    for (var i = 0; i < allApiKeyInputs.length; i++) {
      allApiKeyInputs[i].value = apiKey;
      allApiKeyInputs[i].disabled = true;
    }
    changeBtnDisabled(true);
  }
  else {
    changeBtnDisabled(false);
  }
}

function changeBtnDisabled(isSaved) {
  // disable Save buttons and enable Remove buttons
  var SaveBtns = document.getElementsByClassName("apiKeySave");
  var RemoveBtns = document.getElementsByClassName("apiKeyRemove");
  for (var i = 0; i < SaveBtns.length; i++) {
    SaveBtns[i].disabled = isSaved;
    RemoveBtns[i].disabled = !isSaved;
  }
}

// save API KEY to all input fields for API KEY and save it to LOCAL STORAGE
// Called when "Save" button next to api key input field is pressed 
function saveApiKey(button) {
  // Get api key from input
  var apiKey = button.parentElement.getElementsByClassName("apiKey")[0].value;

  // local storage
  window.localStorage.setItem("apiKey", apiKey);

  // Get ApiKey from local storage and fill all inputs with it
  fillInputsWithApiKey();
}

// Delete ApiKey from all input fields
function removeApiKey() {
  // get all input fields with apiKey
  var allApiKeyInputs = document.getElementsByClassName("apiKey");
  for (var i = 0; i < allApiKeyInputs.length; i++) {
    allApiKeyInputs[i].value = "";
    allApiKeyInputs[i].disabled = false;
  }
  // local storage
  window.localStorage.removeItem("apiKey");
  changeBtnDisabled(false);
}

// create HTML element for API KEY
function addApiKeyHtml() {
  return `<label for="apiKey">API KEY</label>
          <form class="form-inline" style="margin-bottom: 10px;">
            <input type="text" name="apiKey" class="apiKey form-control" style="width: 277px;">
            <button type="button" class="btn btn-primary btn-sm apiKeySave" onclick="saveApiKey(this)">Save</button>
            <button type="button" class="btn btn-primary btn-sm apiKeyRemove" onclick="removeApiKey()">Remove</button>
          </form>`;
}

// Refresh ALL iframes
function refreshWebpageDiv(serverIP, port) {
  var iframes = document.getElementsByClassName('webpage');
  for (var i = 0; i < iframes.length; i++)
    iframes[i].src = `http://${serverIP}:${port}`;
}

// Toolbar for output tabs - only called for app.js file
function addOutputTabs(exerciseName, label, serverIP) {
  serverIP = serverIP.split(":")[0];
  var tabs = $(`<div id="${exerciseName}-output-tabs" class="tab outputTab">                
                            <button class="tablinks btnOutput" onclick="openOutTab(this, '${label}', '${exerciseName}', null)">Output</button>
                            <button class="tablinks btnOutput" onclick="openOutTab(this, '${label}', '${exerciseName}', null)">Error</button>
                            <button class="tablinks btnOutput" onclick="openOutTab(this, '${label}', '${exerciseName}', '${serverIP}')">Webpage</button>
                          </div>`);
  // get div with input and add output toolbar after it
  var firstFileOfExercise = $(document.getElementById(`tutorial-exercise-${label}-input`));
  firstFileOfExercise.after(tabs);
}

// Open JS tab depending on exerciseName and caption
function openOutTab(button, label, exerciseName, serverIP) {
  var credentials = window.localStorage.getItem("credentials");
  var apiKey = window.localStorage.getItem("apiKey");
  // refresh only when Webpage tab is clicked and we have credentials and api key in local storage
  if (serverIP && apiKey && credentials)
    refreshWebpageDiv(serverIP, JSON.parse(credentials).port);
  var classNameHide, classNameShow, exercise, tabcontent, tablinks;
  // if we clicked Output, we want to hide div with class webpage
  switch (button.innerHTML) {
    case "Output":
      classNameHide = ".tutorial-exercise-error, .webpageDiv";
      classNameShow = "tutorial-exercise-server-output";
      break;
    case "Error":
      classNameHide = ".tutorial-exercise-server-output, .webpageDiv";
      classNameShow = "tutorial-exercise-error";
      break;
    default:
      classNameHide = ".tutorial-exercise-error, .tutorial-exercise-server-output";
      classNameShow = "webpageDiv";
      break;
  }

  // Hide other tabs
  exercise = $('[data-label="' + label + '"]')[0];
  tabcontent = $(exercise.querySelectorAll(classNameHide));
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // DIV with tab buttons
  var outTabButtons = document.getElementById(exerciseName + '-output-tabs');
  // buttons for tabs
  tablinks = outTabButtons.getElementsByClassName("tablinks");
  // remove class active from buttons
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // show the chosen tab and mark the button/tab as active
  exercise.getElementsByClassName(classNameShow)[0].style.removeProperty('display');
  button.className += " active";
}

// add new tab for file with name - caption and exercise with name - exerciseName
function addFileTab(exerciseName, caption, label) {
  var currentTabs = document.getElementById(`${exerciseName}-tabs`);
  var tab = $(`<button class="tablinks" onclick="openFileTab(this, '${label}', '${exerciseName}')">${caption}</button>`);
  $(currentTabs).append(tab);
}
// Add input field for API KEY and row with tabs for every exercise
function addApiKeyAndFirstTab(exerciseName, label) {

  var apiKey = addApiKeyHtml();
  var tabs = $(`${apiKey}<div id="${exerciseName}-tabs" class="tab">                
                            <button data-tab="${label}-tab" class="tablinks" onclick="openFileTab(this, '${label}', '${exerciseName}')">app.js</button>
                          </div>`);
  // get first file of exercise with `exercise.id` and add HTML before it
  var firstFileOfExercise = $($(`[data-label="${label}"]`)[0]);
  firstFileOfExercise.before(tabs);
}

// Simulates click on first tab for every exercise
function openFirstTab() {
  // get all DIV with tabs
  var allDivTabs = document.getElementsByClassName("tab");

  // go through all DIV with tabs and simulate click on first tab
  for (var i = 0; i < allDivTabs.length; i++) {
    var singleDivTab = allDivTabs[i];
    var firstButtonTab = $(singleDivTab.getElementsByClassName("tablinks")[0]);
    firstButtonTab.click();
  }
}

// Open JS tab depending on exerciseName and caption
function openFileTab(button, label, exerciseName) {
  var i, tabcontent, tablinks;

  // Hide all files
  tabcontent = $('[data-id="' + exerciseName + '"]');
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // DIV with tab buttons
  var tabButtons = document.getElementById(exerciseName + '-tabs');
  // buttons for tabs
  tablinks = tabButtons.getElementsByClassName("tablinks");
  // remove class active from buttons
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // show the chosen tab and mark the button/tab as active
  $('[data-label="' + label + '"]').css("display", "");
  button.className += " active";
}

/* Exercise solutions */
Tutorial.prototype.$initializeExerciseSolutions = function () {

  // alias this
  var thiz = this;

  // hide solutions when clicking outside exercises
  $(document).on('mouseup', function (ev) {
    var exercise = thiz.$exerciseContainer(ev.target);
    if (exercise.length === 0) {
      thiz.$forEachExercise(thiz.$removeSolution);
    }
  });
};


// add a solution for the specified exercise label
Tutorial.prototype.$addSolution = function (exercise, panel_heading, editor) {

  // alias this
  var thiz = this;

  // get label
  var label = exercise.attr('data-label');

  // solution/hints (in the presence of hints convert solution to last hint)
  var solution = thiz.$exerciseSolutionCode(label);
  var hints = thiz.$exerciseHintsCode(label);
  if (hints !== null && solution !== null) {
    hints.push(solution);
    solution = null;
  }
  var hintDiv = thiz.$exerciseHintDiv(label);

  // function to add a helper button
  function addHelperButton(icon, caption) {
    var button = $('<a class="btn btn-light btn-xs btn-tutorial-solution"></a>');
    button.attr('role', 'button');
    button.attr('title', caption);
    button.append($('<i class="fa ' + icon + '"></i>'));
    button.append(' ' + caption);
    panel_heading.append(button);
    return button;
  }

  // function to add a hint button
  function addHintButton(caption) {
    return addHelperButton("fa-lightbulb-o", caption);
  }

  // helper function to record solution/hint requests
  function recordHintRequest(index) {
    thiz.$recordEvent(label, "exercise_hint", {
      type: solution !== null ? "solution" : "hint",
      index: hintIndex
    });
  }

  // add a startover button
  if (editor.tutorial.startover_code !== null) {
    var startOverButton = addHelperButton("fa-refresh", "Start Over");
    startOverButton.on('click', function () {
      editor.setValue(editor.tutorial.startover_code, -1);
      thiz.$clearExerciseOutput(exercise);
    });
  }

  // if we have a hint div
  if (hintDiv != null) {

    // mark the div as a hint and hide it
    hintDiv.addClass('tutorial-hint');
    hintDiv.css('display', 'none');

    // create hint button
    var button = addHintButton("Hint");

    // handle showing and hiding the hint
    button.on('click', function () {

      // record the request
      recordHintRequest(0);

      // prepend it to the output frame (if a hint isn't already in there)
      var outputFrame = exercise.children('.tutorial-exercise-output-frame');
      if (outputFrame.find('.tutorial-hint').length == 0) {
        var panel = $('<div class="panel panel-default tutorial-hint-panel"></div>');
        var panelBody = $('<div class="panel-body"></div>');
        var hintDivClone = hintDiv.clone().attr('id', '').css('display', 'inherit');
        panelBody.append(hintDivClone);
        panel.append(panelBody);
        outputFrame.prepend(panel);
      } else {
        outputFrame.find('.tutorial-hint-panel').remove();
      }
    });

  }

  // else if we have a solution or hints
  else if (solution || hints) {

    // determine caption
    var caption = null;
    if (solution) {
      caption = "Solution";
    }
    else {
      if (hints.length > 1)
        caption = "Hints";
      else
        caption = "Hint";
    }

    // determine editor lines
    var editorLines = thiz.kMinLines;
    if (solution)
      editorLines = Math.max(thiz.$countLines(solution), editorLines);
    else {
      for (var i = 0; i < hints.length; i++)
        editorLines = Math.max(thiz.$countLines(hints[i]), editorLines);
    }

    // track hint index
    var hintIndex = 0;

    // create solution buttion
    var button = addHintButton(caption);

    // handle showing and hiding the popover
    button.on('click', function () {
      hintIndex = 0;

      // record the request
      recordHintRequest(hintIndex);

      // determine solution text
      var solutionText = solution !== null ? solution : hints[hintIndex];

      var visible = button.next('div.popover:visible').length > 0;
      if (!visible) {
        var popover = button.popover({
          placement: 'top',
          template: '<div class="popover tutorial-solution-popover" role="tooltip">' +
            '<div class="arrow"></div>' +
            '<div class="popover-title tutorial-panel-heading"></div>' +
            '<div class="popover-content"></div>' +
            '</div>',
          content: solutionText,
          trigger: "manual"
        });
        popover.on('inserted.bs.popover', function () {

          // get popover element
          var dataPopover = popover.data('bs.popover');
          var popoverTip = dataPopover.tip();
          var content = popoverTip.find('.popover-content');

          // adjust editor and container height
          var solutionEditor = thiz.$attachAceEditor(content.get(0), solutionText);
          solutionEditor.setReadOnly(true);
          solutionEditor.setOptions({
            minLines: editorLines
          });
          var height = editorLines * solutionEditor.renderer.lineHeight;
          content.css('height', height + 'px');

          // get title panel
          var popoverTitle = popoverTip.find('.popover-title');

          // add next hint button if we have > 1 hint
          if (solution === null && hints.length > 1) {
            var nextHintButton = $('<a class="btn btn-light btn-xs btn-tutorial-next-hint"></a>');
            nextHintButton.append("Next Hint ");
            nextHintButton.append($('<i class="fa fa-angle-double-right"></i>'));
            nextHintButton.on('click', function () {
              hintIndex = hintIndex + 1;
              solutionEditor.setValue(hints[hintIndex], -1);
              if (hintIndex == (hints.length - 1))
                nextHintButton.addClass('disabled');
              recordHintRequest(hintIndex);
            });
            if (hintIndex == (hints.length - 1))
              nextHintButton.addClass('disabled');
            popoverTitle.append(nextHintButton);
          }

          // add copy button
          var copyButton = $('<a class="btn btn-info btn-xs ' +
            'btn-tutorial-copy-solution pull-right"></a>');
          copyButton.append($('<i class="fa fa-copy"></i>'));
          copyButton.append(" Copy to Clipboard");
          popoverTitle.append(copyButton);
          var clipboard = new Clipboard(copyButton[0], {
            text: function (trigger) {
              return solutionEditor.getValue();
            }
          });
          clipboard.on('success', function (e) {
            thiz.$removeSolution(exercise);
            editor.focus();
          });
          copyButton.data('clipboard', clipboard);

        });
        button.popover('show');

        // left position of popover and arrow
        var popoverElement = exercise.find('.tutorial-solution-popover');
        popoverElement.css('left', '0');
        var popoverArrow = popoverElement.find('.arrow');
        popoverArrow.css('left', button.position().left + (button.outerWidth() / 2) + 'px');

        // scroll into view if necessary
        thiz.scrollIntoView(popoverElement);
      }
      else {
        thiz.$removeSolution(exercise);
      }

      // always refocus editor
      editor.focus();
    });
  }
};



// remove a solution for an exercise
Tutorial.prototype.$removeSolution = function (exercise) {

  // destory clipboardjs object if we've got one
  var solutionButton = exercise.find('.btn-tutorial-copy-solution');
  if (solutionButton.length > 0)
    solutionButton.data('clipboard').destroy();

  // destroy popover
  exercise.find('.btn-tutorial-solution').popover('destroy');
};


/* Exercise evaluation */

Tutorial.prototype.$initializeExerciseEvaluation = function () {

  // alias this
  var thiz = this;

  // get the current label context of an element
  function exerciseLabel(el) {
    return thiz.$exerciseContainer(el).attr('data-label');
  }

  // ensure that the exercise containing this element is fully visible
  function ensureExerciseVisible(el) {
    // convert to containing exercise element
    var exerciseEl = thiz.$exerciseContainer(el)[0];

    // ensure visibility
    thiz.scrollIntoView(exerciseEl);
  }

  // register a shiny input binding for code editors
  var exerciseInputBinding = new Shiny.InputBinding();
  $.extend(exerciseInputBinding, {

    find: function (scope) {
      return $(scope).find('.tutorial-exercise-code-editor');
    },

    getValue: function (el) {
      // return null if we haven't been clicked and this isn't a restore
      if (!this.clicked && !this.restore)
        return null;

      // value object to return
      var value = {};

      // get the label
      value.label = exerciseLabel(el);

      // get the code from the editor
      var editor = ace.edit($(el).attr('id'));
      value.code = editor.getSession().getValue();

      value.codeWithComments = value.code;
      if (editor.getSession().$modeId == 'ace/mode/javascript') {
        var uncomment = /((\/\*[\s\S]*?\*\/|\/\/.*))/g;
        value.code = value.code.replace(uncomment, '');
      }

      // get the preserved chunk options (if any)
      var options_script = thiz.$exerciseContainer(el).find('script[data-opts-chunk="1"]');
      if (options_script.length == 1)
        value.options = JSON.parse(options_script.text());
      else
        value.options = {};

      // restore flag
      value.restore = this.restore;

      // get any setup, solution, or check chunks
      // setup
      var label = exerciseLabel(el);
      if (value.options["exercise.setup"])
        value.setup = thiz.$exerciseSupportCode(value.options["exercise.setup"]);
      else
        value.setup = thiz.$exerciseSupportCode(label + "-setup");

      // solution
      value.solution = thiz.$exerciseSupportCode(label + "-solution");

      // check
      if (this.check) {
        value.code_check = thiz.$exerciseSupportCode(label + "-code-check");
        value.check = thiz.$exerciseCheckCode(label);
      }

      // some randomness to ensure we re-execute on button clicks
      value.timestamp = new Date().getTime();

      // return the value
      return value;
    },

    subscribe: function (el, callback) {
      var binding = this;
      this.runButtons(el).on('click.exerciseInputBinding', function (ev) {
        binding.restore = false;
        binding.clicked = true;
        binding.check = ev.target.hasAttribute('data-check');
        callback(true);
      });
      $(el).on('restore.exerciseInputBinding', function (ev, options) {
        binding.restore = true;
        binding.clicked = false;
        binding.check = options.check;
        callback(true);
      });
    },

    unsubscribe: function (el) {
      this.runButtons(el).off('.exerciseInputBinding');
    },

    runButtons: function (el) {
      var exercise = thiz.$exerciseContainer(el);
      return exercise.find('.btn-tutorial-run');
    },

    restore: false,
    clicked: false,
    check: false
  });
  Shiny.inputBindings.register(exerciseInputBinding, 'tutorial.exerciseInput');

  // register an output binding for exercise output
  var exerciseOutputBinding = new Shiny.OutputBinding();
  $.extend(exerciseOutputBinding, {

    find: function find(scope) {
      return $(scope).find('.tutorial-exercise-output');
    },

    onValueError: function onValueError(el, err) {

      Shiny.unbindAll(el);
      this.renderError(el, err);
    },

    renderValue: function renderValue(el, data) {

      // remove default content (if any)
      this.outputFrame(el).children().not($(el)).remove();

      // render the content
      Shiny.renderContent(el, data);

      // bind bootstrap tables if necessary
      if (window.bootstrapStylePandocTables)
        window.bootstrapStylePandocTables();

      // bind paged tables if necessary
      if (window.PagedTableDoc)
        window.PagedTableDoc.initAll();

      // scroll exercise fully into view if we aren't restoring
      var restoring = thiz.$exerciseContainer(el).data('restoring');
      if (!restoring) {
        ensureExerciseVisible(el);
        thiz.$exerciseContainer(el).data('restoring', false);
      } else {
        thiz.$logTiming("restored-exericse-" + exerciseLabel(el));
      }
    },

    showProgress: function (el, show) {
      thiz.$showExerciseProgress(exerciseLabel(el), null, show);
    },

    outputFrame: function (el) {
      return $(el).closest('.tutorial-exercise-output-frame');
    }
  });
  Shiny.outputBindings.register(exerciseOutputBinding, 'tutorial.exerciseOutput');
};

Tutorial.prototype.$clearExerciseOutput = function (exercise) {
  var outputFrame = $(exercise).find('.tutorial-exercise-output-frame');
  var outputDiv = $(outputFrame).children('.tutorial-exercise-output');
  outputFrame.children().not(outputDiv).remove();
  outputDiv.empty();
}


/* Storage */
Tutorial.prototype.$initializeStorage = function (identifiers, success) {

  // alias this
  var thiz = this;

  if (!(typeof window.Promise != "undefined" && typeof window.indexedDB != "undefined")) {
    // can not do db stuff.
    // return early and do not create hooks
    success({});
    return;
  }

  // initialize data store. note that we simply ignore errors for interactions
  // with storage since the entire behavior is a nice-to-have (i.e. we automatically
  // degrade gracefully by either not restoring any state or restoring whatever
  // state we had stored)
  var dbName = "LearnrTutorialProgress";
  // var storeName = "Store_" + btoa(Math.random()).slice(0, 4);
  var storeName = "Store_" + window.btoa(identifiers.tutorial_id + identifiers.tutorial_version);

  var closeStore = function (store) {
    store._dbp.then(function (db) {
      db.close();
    })
  }

  // tl/dr; Do not keep indexedDB connections around

  // All interactions must:
  //   1. open the object store.
  //   2. do the transaction on the object store.
  //   3. close the object store.
  // Known store interactions:
  // * set answer
  // * clear all existing keys
  // * get all exising keys

  // Problem (if connections are kept alive):
  //   * If a new object store is to be added, this can only be done by opening a db connection with a higher version.
  //   * The "higher version" connection can not be opened until all other tabs have released their "older version" connection.
  // Approach:
  //   * By using the indexedDB in a "open, do, close" manor, all interactions will not be blocking all other tabs if a new object store is added.
  // Example:
  //   * If a tab connects, reads, disconnects...
  //   * Then another tab bumps the version...
  //   * Then, when the original tab wants to read the db, it can connect (db-version-less) and not have any issues
  // Notes:
  //   * indexedDB db version management is handled within idb-keyval

  // custom message handler to update store
  Shiny.addCustomMessageHandler("tutorial.store_object", function (message) {
    var idbStoreSet = new window.idbKeyval.Store(
      dbName,
      storeName
    );

    window.idbKeyval
      .set(message.id, message.data, idbStoreSet)
      .catch(function (err) {
        console.error(err);
      })
      .finally(function () {
        closeStore(idbStoreSet);
      });
  });

  // mask prototype to clear out all key/vals
  thiz.$removeState = function (completed) {
    var idbStoreClear = new window.idbKeyval.Store(
      dbName,
      storeName
    );

    window.idbKeyval.clear(idbStoreClear)
      .then(completed)
      .catch(function (err) {
        console.error(err);
        completed();
      })
      .finally(function () {
        closeStore(idbStoreClear);
      });
  }


  // retreive the currently stored objects then pass them down to restore_state
  var idbStoreGet = new window.idbKeyval.Store(
    dbName,
    storeName
  );
  window.idbKeyval
    .keys(idbStoreGet)
    .then(function (keys) {
      var getPromises = keys.map(function (key) {
        return window.idbKeyval.get(key, idbStoreGet);
      });
      return Promise.all(getPromises)
        .then(function (vals) {
          var ret = {}, i;
          for (i = 0; i < keys.length; i++) {
            ret[keys[i]] = vals[i];
          }
          return ret;
        });
    })
    .then(function (objs) {
      success(objs);
    })
    .catch(function (err) {
      console.error(err);
      success({});
    })
    // use finally to make sure it attempts to close
    .finally(function () {
      closeStore(idbStoreGet);
    });

};


Tutorial.prototype.$restoreState = function (objects) {

  // alias this
  var thiz = this;

  // retreive state from server
  thiz.$logTiming("restoring-state");
  this.$serverRequest("restore_state", objects, function (data) {

    thiz.$logTiming("state-received");

    // initialize client state
    thiz.$initializeClientState(data.client_state);

    // fire init event
    thiz.$fireInit();

    // initialize progress
    thiz.$initializeProgress(data.progress_events);

    // restore exercise and question submissions
    thiz.$restoreSubmissions(data.submissions);

    // initialize video players
    thiz.$initializeVideoPlayers(data.video_progress);

  });
};


Tutorial.prototype.$restoreSubmissions = function (submissions) {

  // alias this
  var thiz = this;

  for (var i = 0; i < submissions.length; i++) {

    var submission = submissions[i];
    var type = submission.type;
    var id = submission.id;

    // exercise submissions
    if (type === "exercise_submission") {

      // get code and checked status
      var label = id;
      var code = submission.data.code == null ? "" : submission.data.code;
      var checked = submission.data.checked;

      thiz.$logTiming("restoring-exercise-" + label);

      // find the editor
      var editorContainer = thiz.$exerciseEditor(label);
      if (editorContainer.length > 0) {

        // restore code
        var editor = ace.edit(editorContainer.attr('id'));
        editor.setValue(code, -1);

        // fire restore event on the container (also set
        // restoring flag on the exercise so we don't scroll it
        // into view after restoration)
        thiz.$exerciseForLabel(label).data('restoring', true);
        thiz.$showExerciseProgress(label, 'run', true);
        editorContainer.trigger('restore', {
          check: checked
        });
      }
    }
    // question_submission's are done with shiny directly
  }
};


Tutorial.prototype.$removeState = function (completed) {
  completed();
};

Tutorial.prototype.$initializeClientState = function (client_state) {

  // alias this
  var thiz = this;

  // client state object
  var last_client_state = {
    scroll_position: 0,
    hash: ''
  };

  // debounced checker for scroll position
  var maybePersistClientState = this.$debounce(function () {

    // get current client state
    var current_client_state = {
      'scroll_position': $(window).scrollTop(),
      'hash': window.location.hash
    };

    // if it changed then persist it and upate last
    if ((current_client_state.scroll_position != last_client_state.scroll_position) ||
      current_client_state.hash != last_client_state.hash) {
      thiz.$serverRequest("set_client_state", current_client_state, null);
      last_client_state = current_client_state;
    }
  }, 1000);

  // check for client state on scroll position changed and hash changed
  $(window).scroll(maybePersistClientState);
  window.addEventListener("popstate", maybePersistClientState);

  // restore hash if there wasn't a hash already
  if (!window.location.hash && client_state.hash) {
    window.location.hash = client_state.hash;
  }

  // restore scroll position (don't do this for now as it ends up being
  // kind of janky)
  //if (client_state.scroll_position)
  //  $(window).scrollTop(client_state.scroll_position);
};


/* Server initialization */

// once we receive this message from the R side, we know that
// `register_http_handlers()` has been run, indicating that the
// Shiny server is ready to handle http requests
Shiny.addCustomMessageHandler("tutorial_isServerAvailable", function (message) {
  tutorial_isServerAvailable = true;
})

Tutorial.prototype.$initializeServer = function () {

  // one-shot function to initialize server (wait for Shiny.shinyapp
  // to be available before attempting to call server)
  var thiz = this;
  thiz.$logTiming("wait-server-available");
  function initializeServer() {

    // retry after a delay
    function retry(delay) {
      setTimeout(function () {
        initializeServer();
      }, delay);
    }

    // wait for shiny config to be available (required for $serverRequest)
    if (tutorial_isServerAvailable) {
      thiz.$logTiming("server-available");
      thiz.$serverRequest("initialize", { location: window.location },
        function (response) {
          thiz.$logTiming("server-initialized");
          // initialize storage then restore state
          thiz.$initializeStorage(response.identifiers, function (objects) {
            thiz.$logTiming("storage-initialized");
            thiz.$restoreState(objects);
          });
        }
      );
    }
    else {
      retry(250);
    }
  }

  // call initialize function
  initializeServer();
};
