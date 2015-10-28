// Alerta Chrome Extension
// Copyright (c) 2014 Andy Botting
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

function saveOptions() {

  var api_url = document.getElementById('api_url').value;
  var api_key = document.getElementById('api_key').value;
  var dashboard_url = document.getElementById('dashboard_url').value;

  var envs = {
    'Production': document.getElementById('env_prod').checked,
    'Infrastructure': document.getElementById('env_infra').checked,
    'Development': document.getElementById('env_dev').checked
  };

  var sevs = {
    'critical':  document.getElementById('sev_critical').checked,
    'major': document.getElementById('sev_major').checked,
    'minor':   document.getElementById('sev_minor').checked,
    'warning':   document.getElementById('sev_warning').checked,
    'indeterminate':   document.getElementById('sev_indeterminate').checked,
    'informational':   document.getElementById('sev_inform').checked,
    'debug':   document.getElementById('sev_debug').checked,
    'security':   document.getElementById('sev_auth').checked
  };

  localStorage['api_url'] = api_url
  localStorage['api_key'] = api_key
  localStorage['dashboard_url'] = dashboard_url
  localStorage['environments'] = JSON.stringify(envs);
  localStorage['severities'] = JSON.stringify(sevs);
  console.log('localStorage=' + JSON.stringify(localStorage));

  // Update status to let user know options were saved.
  var status = document.getElementById('status');
  status.innerHTML = 'Options Saved.';
  setTimeout(function() {
    status.innerHTML = '';
  }, 2000);
}

// Restores select box state to saved value from localStorage.
function restoreOptions() {
  console.log('Restore options');

  var api_url = localStorage['api_url'];
  if (api_url == null) {
    api_url = 'http://api.alerta.io';
  }
  console.log("API URL: " + api_url);
  document.getElementById('api_url').value = api_url;

  var api_key = localStorage['api_key'];
  if (api_key == null) {
    api_key = 'demo-key';
  }
  console.log("API Key: " + api_key);
  document.getElementById('api_key').value = api_key;

  var dashboard_url = localStorage['dashboard_url'];
  if (dashboard_url == null) {
    dashboard_url = 'http://try.alerta.io';
  }
  console.log("Dashboard URL: " + dashboard_url);
  document.getElementById('dashboard_url').value = dashboard_url;

  var env_str = localStorage['environments'];
  if (env_str == null) {
    // Default options if not set
    envs = {
      'Production':  true,
      'Infrastructure': true,
      'Development':   false
    };
  } else {
    console.log(env_str);
    envs = JSON.parse(env_str);
  }

  document.getElementById('env_prod').checked = envs['Production'];
  document.getElementById('env_infra').checked = envs['Infrastructure'];
  document.getElementById('env_dev').checked = envs['Development'];

  var sev_str = localStorage['severities'];
  if (sev_str == null) {
    // Default options if not set
    sevs = {
      'critical':  true,
      'major': true,
      'minor':   false,
      'warning':   false,
      'indeterminate':   false,
      'informational':   false,
      'debug':   false,
      'security':   false,
    };
  } else {
    console.log(sev_str);
    sevs = JSON.parse(sev_str);
  }

  console.log("Severity critical: " + sevs['critical']);
  console.log("Severity major: " + sevs['major']);
  console.log("Severity minor: " + sevs['minor']);
  console.log("Severity warning: " + sevs['warning']);
  console.log("Severity indeterminate: " + sevs['indeterminate']);
  console.log("Severity informational: " + sevs['informational']);
  console.log("Severity debug: " + sevs['debug']);
  console.log("Severity security: " + sevs['security']);
  document.getElementById('sev_critical').checked = sevs['critical'];
  document.getElementById('sev_major').checked = sevs['major'];
  document.getElementById('sev_minor').checked = sevs['minor'];
  document.getElementById('sev_warning').checked = sevs['warning'];
  document.getElementById('sev_indeterminate').checked = sevs['indeterminate'];
  document.getElementById('sev_inform').checked = sevs['informational'];
  document.getElementById('sev_debug').checked = sevs['debug'];
  document.getElementById('sev_auth').checked = sevs['security'];
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector('#save').addEventListener('click', saveOptions);
