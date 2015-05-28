"use strict";
// initialize Hoodie
var hoodie  = new Hoodie();

// HELPER FUNCTIONS -----------------------------
function setLoggedIn(state) {
  if (state) {
    // set page layout to logged in state
    $('#loginName').val('');
    $('#loginPassword').val('');
    $('#loginModal').modal('hide');
    $('#loginFailed').addClass("hidden");
    $('#loginButton').addClass("hidden");
    $('#logoutButton').removeClass("hidden");
    $('.hoodieUsername').html(hoodie.account.username);
    $('#userText').removeClass("hidden");
  }
  else {
    // set page layout to logged out state
    $('#loginButton').removeClass("hidden");
    $('#logoutButton').addClass("hidden");
    $('.hoodieUsername').html('');
    $('#userText').addClass("hidden");
  };
}

// EVENTS ---------------------------------------
$('#loginForm').submit(function(event) {
  event.preventDefault();
  var username = $('#loginName').val();
  var password = $('#loginPassword').val();

  hoodie.account.signIn(username, password)
  .done(
    function() {
      // login successful
      setLoggedIn(true);
    }
  ).fail(
    function() {
      // login failed
      $('#loginFailed').removeClass("hidden");
      setLoggedIn(false);
    }
  );
});

$('#logoutButton').click(function(){
  hoodie.account.signOut();
  setLoggedIn(false);
});

hoodie.account.on('error:unauthenticated signout', function() {
  setLoggedIn(false);
});

hoodie.account.on('signin signup', function(){
  setLoggedIn(true);
});

// ON PAGE LOAD ---------------------------------
if (hoodie.account.username == undefined) {
  setLoggedIn(false);
} else {
  setLoggedIn(true);
};
