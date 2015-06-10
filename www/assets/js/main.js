"use strict";

// initialize Hoodie
var hoodie = new Hoodie();

// helper function to escape HTML
function escapeHtml(string) {
  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}

// execute when DOM is ready
$(function() {

  // enable autoNumeric to help entering currency data
  $('.autonumeric').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

  // insert today's date as default
  $('.insertToday').val(moment().format('DD.MM.YYYY'));

  var spendApp = new App('spend');
});
