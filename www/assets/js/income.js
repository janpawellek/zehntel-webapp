
// execute when DOM is ready
$(function() {

  // let the income hand blink
  var blinkHand = function() {
    setTimeout(function(){ $('#income-hand').toggleClass('text-success'); blinkHand(); }, 1000);
  };
  blinkHand();

  // on submit of new income
  $('#income-new-form').on('submit', function(event) {
    event.preventDefault();
    $('#income-dist-div').removeClass('hidden');
  });

  // close distribution panel on click on the upper right x
  $('#income-dist-div-close').on('click', function(event) {
    $('#income-dist-div').addClass('hidden');
  })
});
