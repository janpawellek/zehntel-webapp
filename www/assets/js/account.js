"use strict";
// initialize Hoodie
var hoodie  = new Hoodie();

// HELPER FUNCTIONS -----------------------------
function setLoggedIn(state) {
  if (state) {
    // set page layout to logged in state
    $('.onLoginClearVal').val('');
    $('.onLoginHide').addClass('hidden');
    $('.onLoginShow').removeClass('hidden');

    // hide login dialog and show user name
    $('#loginModal').modal('hide');
    $('.hoodieUsername').html(hoodie.account.username);
  }
  else {
    // set page layout to logged out state
    $('.onLogoffShow').removeClass('hidden');
    $('.onLogoffHide').addClass('hidden');

    // important: clear everything in the DOM from the previously logged in user
    $('.onLogoffClearContent').html('');
    $('.onLogoffClearVal').val('');
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
      $('#loginFailed').removeClass('hidden');
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
