// Alerta Chrome Extension
// Copyright (c) 2014 Guardian News & Media
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// This code is based on the Google Mail Checker extension by Google.
//
// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//

var animationFrames = 36;
var animationSpeed = 10; // ms
var canvas = document.getElementById('canvas');
var canvasImage = document.getElementById('alerta_img');
var canvasContext = canvas.getContext('2d');
var pollInterval = 1;  // 1 min
var requestTimeout = 1000 * 2;  // 2 seconds
var rotation = 0;
var loadingAnimation = new LoadingAnimation();

// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime;
var requestTimerId;

var dashboardUrlPath = '/v2/index.html';
var feedUrlPath = '/v2/alerts/counts?';

function getAPIUrl() {
  var api_url = localStorage['api_url'];
  if (api_url == null) {
    // Default URL for the Guardian
    api_url = 'http://monitoring.guprod.gnm:8080/alerta/api'
  }
  return api_url + feedUrlPath
}

function getDashboardUrl() {
  var dashboard_url = localStorage['dashboard_url'];
  if (dashboard_url == null) {
    // Default URL for the Guardian
    dashboard_url = 'http://monitoring.guprod.gnm/alerta/dashboard'
  }
  return dashboard_url + dashboardUrlPath
}

function getEnvironments() {
  var env_str = localStorage['environments'];
  if (env_str == null) {
    // Default options if not set
    envs = {
      'PROD':  true,
      'INFRA': true,
      'DEV':   false
    };
  } else {
    envs = JSON.parse(env_str);
  }
  console.log(envs);

  envs_option = []
  for (var key in envs) {
    if (envs[key] == true)
      envs_option.push(key);
  }

  console.log(envs_option.join('|'));
  return 'environment=' + envs_option.join('|')
}

function getSeverities() {
  var sev_str = localStorage['severities'];
  if (sev_str == null) {
    // Default options if not set
    sevs = {
      'critical':  true,
      'major': true,
      'minor':   false,
      'warning':   false,
      'normal':   false,
      'informational':   false
    };
  } else {
    sevs = JSON.parse(sev_str);
  }
  console.log(sevs);

  sevs_option = []
  for (var key in sevs) {
    if (sevs[key] == true)
      sevs_option.push(key);
  }

  console.log(sevs_option.join('|'));
  return 'severity=' + sevs_option.join('|')
}

function isAlertaUrl(url) {
  // Return whether the URL starts with the Alerta prefix.
  return url.indexOf(getDashboardUrl()) == 0;
}

// A "loading" animation displayed while we wait for the first response from
// Alerta. This animates the badge text with a dot that cycles from left to
// right.
function LoadingAnimation() {
  this.timerId_ = 0;
  this.maxCount_ = 8;  // Total number of states in animation
  this.current_ = 0;  // Current state
  this.maxDot_ = 4;  // Max number of dots in animation
}

LoadingAnimation.prototype.paintFrame = function() {
  var text = "";
  for (var i = 0; i < this.maxDot_; i++) {
    text += (i == this.current_) ? "." : " ";
  }
  if (this.current_ >= this.maxDot_)
    text += "";

  chrome.browserAction.setBadgeText({text:text});
  this.current_++;
  if (this.current_ == this.maxCount_)
    this.current_ = 0;
}

LoadingAnimation.prototype.start = function() {
  if (this.timerId_)
    return;

  var self = this;
  this.timerId_ = window.setInterval(function() {
    self.paintFrame();
  }, 100);
}

LoadingAnimation.prototype.stop = function() {
  if (!this.timerId_)
    return;

  window.clearInterval(this.timerId_);
  this.timerId_ = 0;
}

function updateIcon() {
  if (!localStorage.hasOwnProperty('alertCount')) {
    chrome.browserAction.setIcon({path:"icon.png"});
    chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
    chrome.browserAction.setBadgeText({text:"?"});
  } else {
    chrome.browserAction.setIcon({path: "icon.png"});
    chrome.browserAction.setBadgeBackgroundColor({color:[208, 0, 24, 255]}); // red
    chrome.browserAction.setBadgeText({
      text: localStorage.alertCount != "0" ? localStorage.alertCount : ""
    });
  }
}

function scheduleRequest() {
  console.log('scheduleRequest');
  var randomness = Math.random() * 2;
  var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
  var multiplier = Math.max(randomness * exponent, 1);
  var delay = Math.min(multiplier * pollInterval);
  delay = Math.round(delay);
  console.log('Scheduling for: ' + delay);

  if (oldChromeVersion) {
    if (requestTimerId) {
      window.clearTimeout(requestTimerId);
    }
    requestTimerId = window.setTimeout(onAlarm, delay*60*1000);
  } else {
    console.log('Creating alarm');
    // Use a repeating alarm so that it fires again if there was a problem
    // setting the next alarm.
    chrome.alarms.create('refresh', {periodInMinutes: delay});
  }
}

// ajax stuff
function startRequest(params) {
  // Schedule request immediately. We want to be sure to reschedule, even in the
  // case where the extension process shuts down while this request is
  // outstanding.
  if (params && params.scheduleRequest) scheduleRequest();

  function stopLoadingAnimation() {
    if (params && params.showLoadingAnimation) loadingAnimation.stop();
  }

  if (params && params.showLoadingAnimation)
    loadingAnimation.start();

  getAlertCount(
    function(count) {
      stopLoadingAnimation();
      updateAlertCount(count);
    },
    function() {
      stopLoadingAnimation();
      delete localStorage.alertCount;
      updateIcon();
    }
  );
}

function getAlertCount(onSuccess, onError) {
  console.log('getAlertCount');
  var xhr = new XMLHttpRequest();
  var abortTimerId = window.setTimeout(function() {
    xhr.abort();  // synchronously calls onreadystatechange
  }, requestTimeout);

  function handleSuccess(count) {
    localStorage.requestFailureCount = 0;
    window.clearTimeout(abortTimerId);
    if (onSuccess)
      onSuccess(count);
  }

  var invokedErrorCallback = false;
  function handleError() {
    ++localStorage.requestFailureCount;
    window.clearTimeout(abortTimerId);
    if (onError && !invokedErrorCallback)
      onError();
    invokedErrorCallback = true;
  }

  try {
    xhr.onreadystatechange = function() {
      if (xhr.readyState != 4)
        return;

      console.log(getAPIUrl() + feedUrlPath + getEnvironments() + '&' + getSeverities());
      var resp = JSON.parse(xhr.responseText);
      console.log('Open Alerts count: ' + resp.response.alerts.statusCounts.open);

      // JSON returned from Alerts must be valid
      if (resp.response) {
        var xmlDoc = xhr.responseXML;
        var status = resp.response.status
        var count = resp.response.alerts.statusCounts.open
        console.log(status);
        if (status == 'ok') {
          console.log('count=' + count);
          handleSuccess(count);
          return;
        } else {
          console.error("JSON parse error or status not 'ok'");
        }
      }

      handleError();
    };

    xhr.onerror = function(error) {
      handleError();
    };

    xhr.open("GET", getAPIUrl() + feedUrlPath + getEnvironments() + '&' + getSeverities(), true);
    xhr.send(null);
  } catch(e) {
    console.error("alerta_check_exception", e);
    handleError();
  }
}

function updateAlertCount(count) {
  var changed = localStorage.alertCount != count;
  localStorage.alertCount = count;
  updateIcon();
  if (changed)
    animateFlip();
}


function ease(x) {
  return (1-Math.sin(Math.PI/2+x*Math.PI))/2;
}

function animateFlip() {
  rotation += 1/animationFrames;
  drawIconAtRotation();

  if (rotation <= 1) {
    setTimeout(animateFlip, animationSpeed);
  } else {
    rotation = 0;
    updateIcon();
  }
}

function drawIconAtRotation() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.translate(
      Math.ceil(canvas.width/2),
      Math.ceil(canvas.height/2));
  canvasContext.rotate(2*Math.PI*ease(rotation));
  canvasContext.drawImage(canvasImage,
      -Math.ceil(canvas.width/2),
      -Math.ceil(canvas.height/2));
  canvasContext.restore();

  chrome.browserAction.setIcon({imageData:canvasContext.getImageData(0, 0,
      canvas.width,canvas.height)});
}

function goToAlerta() {
  console.log('Going to Alerta...');
  chrome.tabs.getAllInWindow(undefined, function(tabs) {
    for (var i = 0, tab; tab = tabs[i]; i++) {
      if (tab.url && isAlertaUrl(tab.url)) {
        console.log('Found Alerta tab: ' + tab.url + '. ' +
                    'Focusing and refreshing count...');
        chrome.tabs.update(tab.id, {selected: true});
        startRequest({scheduleRequest:false, showLoadingAnimation:false});
        return;
      }
    }
    console.log('Could not find Alerta tab. Creating one...');
    chrome.tabs.create({url: getDashboardUrl()});
  });
}

function onInit() {
  console.log('onInit');
  localStorage.requestFailureCount = 0;  // used for exponential backoff
  startRequest({scheduleRequest:true, showLoadingAnimation:true});
  if (!oldChromeVersion) {
    // TODO(mpcomplete): We should be able to remove this now, but leaving it
    // for a little while just to be sure the refresh alarm is working nicely.
    chrome.alarms.create('watchdog', {periodInMinutes:1});
  }
}

function onAlarm(alarm) {
  console.log('Got alarm', alarm);
  // |alarm| can be undefined because onAlarm also gets called from
  // window.setTimeout on old chrome versions.
  if (alarm && alarm.name == 'watchdog') {
    onWatchdog();
  } else {
    startRequest({scheduleRequest:true, showLoadingAnimation:false});
  }
}

function onWatchdog() {
  chrome.alarms.get('refresh', function(alarm) {
    if (alarm) {
      console.log('Refresh alarm exists. Yay.');
    } else {
      console.log('Refresh alarm doesn\'t exist!? ' +
                  'Refreshing now and rescheduling.');
      startRequest({scheduleRequest:true, showLoadingAnimation:false});
    }
  });
}


chrome.runtime.onInstalled.addListener(onInit);
chrome.alarms.onAlarm.addListener(onAlarm);

function onNavigate(details) {
  if (details.url && isAlertaUrl(details.url)) {
    console.log('Recognized Alerta navigation to: ' + details.url + '.' +
                'Refreshing count...');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
  }
}
if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
  chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(
      onNavigate);
} else {
  chrome.tabs.onUpdated.addListener(function(_, details) {
    onNavigate(details);
  });
}

chrome.browserAction.onClicked.addListener(goToAlerta);

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(function() {
    console.log('Starting browser... updating icon.');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
} else {
  // This hack is needed because Chrome 22 does not persist browserAction icon
  // state, and also doesn't expose onStartup. So the icon always starts out in
  // wrong state. We don't actually use onStartup except as a clue that we're
  // in a version of Chrome that has this problem.
  chrome.windows.onCreated.addListener(function() {
    console.log('Window created... updating icon.');
    startRequest({scheduleRequest:false, showLoadingAnimation:false});
    updateIcon();
  });
}
