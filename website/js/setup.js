// Requires dashboard-ajax.js
// Requires modal.js


// details = {
//            locked: true/false
//            database: {status:, details:},
//            schema: {status:, details:, button:}
//            roster:
//            classes:
//            awards:
//            settings:
//            form_fields: {drivers:, radio:, sqlite_path:, mysql_host:, mysql_dbname:, odbc_dsn_name:}
function populate_details(details) {
  $("#database_step div.status_icon img").attr('src', 'img/status/' + details.database.status + '.png');
  $("#schema_step div.status_icon img").attr('src', 'img/status/' + details.schema.status + '.png');
  $("#roster_step div.status_icon img").attr('src', 'img/status/' + details.roster.status + '.png');
  $("#classes_step div.status_icon img").attr('src', 'img/status/' + details.classes.status + '.png');
  $("#awards_step div.status_icon img").attr('src', 'img/status/' + details.awards.status + '.png');
  $("#settings_step div.status_icon img").attr('src', 'img/status/' + details.settings.status + '.png');

  $("#roster_step input[type='submit'], "
    + "#classes_step input[type='submit'], "
    + "#awards_step input[type='submit'], "
    + "#settings_step input[type='submit']")
    .prop('disabled', (details.schema.button == 'disabled') || !details.database.writable);

  $("#database_step").toggleClass('hidden', details.locked);
  
  if (details.schema.button == 'disabled' || !details.database.writable) {
    $("#schema_step input[type='button']")
      .prop('disabled', true).attr('value', 'Initialize');
  } else if (details.schema.button == 'initialize') {
    $("#schema_step input[type='button']")
      .prop('disabled', false).attr('value', 'Initialize')
      .on('click', function() { show_initialize_schema_modal(); });
  } else if (details.schema.button == 'update') {
    $("#schema_step input[type='button']")
      .prop('disabled', false).attr('value', 'Update Schema')
      .on('click', function() { show_update_schema_modal(); });
  } else /* 're-initialize' */ {
    $("#schema_step input[type='button']")
      .prop('disabled', false).attr('value', 'Re-Initialize')
      .on('click', function() { show_initialize_schema_modal(); });
  }

  $("#classes_step a.button_link").text("Edit " + details.classes.label + "s");

  $("#database_step div.step_details").html(details.database.details);
  $("#schema_step div.step_details").html(details.schema.details);
  $("#roster_step div.step_details").html(details.roster.details);
  $("#classes_step div.step_details").html(details.classes.details);
  $("#awards_step div.step_details").html(details.awards.details);
  $("#settings_step div.step_details").html(details.settings.details);

  function maybe_mark_driver_missing(driver, radio_id) {
    var driver_ok = ($.inArray(driver, details.form_fields.drivers) >= 0);
    if (driver_ok) {
      $('#' + radio_id).checkboxradio('enable');
      $('label[for="' + radio_id + '"] span.missing_driver').html('');
    } else {
      $('#' + radio_id).checkboxradio('disable');
      $('label[for="' + radio_id + '"] span.missing_driver').html('(Driver not loaded!)');
    }
  }
  
  maybe_mark_driver_missing('sqlite', 'sqlite_connection');
  maybe_mark_driver_missing('mysql', 'mysql_connection');
  maybe_mark_driver_missing('odbc', 'odbc_connection');
  
  $("#advanced_database_modal input[type='radio']").prop('checked', false);
  $("#" + details.form_fields.radio + "_connection").prop('checked', true);

  $(".connection_details").addClass("hidden");
  $("#for_" + details.form_fields.radio + "_connection").removeClass("hidden");

  $("#odbc_dsn_name").val(details.form_fields.odbc_dsn_name);
  $("#mysql_host").val(details.form_fields.mysql_host);
  $("#mysql_dbname").val(details.form_fields.mysql_dbname);
  $("#sqlite_path").val(details.form_fields.sqlite_path);
  $("#connection_string").val(details.form_fields.connection_string);
}

function populate_details_from_xml(data) {
  var details = data.documentElement.getElementsByTagName("details");
  if (details && details.length > 0) {
    populate_details(JSON.parse(details[0].textContent));
  }
}

function hide_reporting_box() {
  $("#reporting_box").removeClass('success failure').addClass('hidden').css('opacity', 100);
  $("#reporting_box_dismiss").addClass('hidden');
}

function report_in_progress() {
  $("#reporting_box_content").text("In Progress...");
  $("#reporting_box").removeClass('hidden success failure');
}

function report_success() {
  $("#reporting_box_content").text("Success");
  $("#reporting_box").addClass('success').removeClass('hidden');
  setTimeout(function() {
    $("#reporting_box").animate({opacity: 0}, 500,
                                function () { hide_reporting_box(); });
  }, 1000);
}

function report_failure(text) {
  $("#reporting_box_content").text(text);
  $("#reporting_box_dismiss").removeClass('hidden');
  $("#reporting_box").addClass('failure').removeClass('hidden');
  // Has to be explicitly cleared -- no timout to disappear
}

function report_success_xml(data) {
  var success = data.documentElement.getElementsByTagName("success");
  if (success && success.length > 0) {
    populate_details_from_xml(data);
    report_success();
  } else {
    var fail = data.documentElement.getElementsByTagName("failure");
    if (fail && fail.length > 0) {
      report_failure(fail[0].textContent);
    } else {
      // Program bug -- the response should specify either <success/> for <failure/>
      report_failure("Not successful");
    }
  }
}

function show_ezsetup_modal() {
  $('#ez_database_name').val('');
  $('#ez-old-nochoice').prop('selected', 'selected');
  $('#ez_database_select').selectmenu('refresh');
  show_modal("#ezsetup_modal", function(event) {
    handle_ezsetup_modal_submit();
    return false;
  });
}

function handle_ezsetup_modal_submit() {
  close_modal("#ezsetup_modal");
  var dbname = $("#ez_database_name").val();

  var myform = $("#ezsetup_modal form");
  var serialized = myform.serialize();

  report_in_progress();
  $.ajax('action.php',
         {type: 'POST',
          data: serialized, // action = setup.nodata
          success: function(data) {
            report_success_xml(data);
          },
          error: function(event, jqXHR, ajaxSettings, thrownError) {
            report_failure(thrownError);
          }
         });
}

// Pulled out as a separate function because it uses two fields
function write_mysql_connection_string() {
  $('#connection_string').val('mysql:' + 
                              'host=' + $('#mysql_host').val() + ';' +
                              'dbname=' + $('#mysql_dbname').val());
}

function hide_or_show_connection(jq, show) {
  if (show) {
    jq.slideDown();
    jq.removeClass('hidden');
  } else {
    jq.addClass('hidden');
    jq.slideUp();
  }
}

function update_sqlite_path() {
  $('#connection_string').val('sqlite:' + $("#sqlite_path").val());
}

function show_advanced_database_modal() {
  hide_modal("#ezsetup_modal");
  show_modal("#advanced_database_modal", function(event) {
    handle_advanced_database_modal_submit();
    return false;
  });

  // Merely setting the "checked" attribute doesn't trigger the "change"
  // handler that displays the right extra fields.
  $('input[name="connection_type"][checked]').click();
  $('input[name="connection_type"]').checkboxradio("refresh");
}

function handle_advanced_database_modal_submit() {
  close_modal("#advanced_database_modal");

  var myform = $("#advanced_database_modal form");
  // Serialize form data while temporarily enabling disabled inputs
  // (like #connection_string)
  var disabled = myform.find(':input:disabled').removeAttr('disabled');
  var serialized = myform.serialize();
  disabled.attr('disabled', 'disabled');

  report_in_progress();
  $.ajax('action.php',
         {type: 'POST',
          data: serialized, // action = setup.nodata
          success: function(data) {
            report_success_xml(data);
          },
          error: function(event, jqXHR, ajaxSettings, thrownError) {
            report_failure(thrownError);
          }
         });
}

function show_initialize_schema_modal() {
  show_modal("#initialize_schema_modal", function(event) {
    handle_initialize_schema();
    return false;
  });
}

function handle_initialize_schema() {
  close_modal("#initialize_schema_modal");
  report_in_progress();
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'database.execute',
                 script: 'schema'},
          success: function(data) {
            report_success_xml(data);
          },
          error: function(event, jqXHR, ajaxSettings, thrownError) {
            report_failure(thrownError);
          }
         });
}

function show_update_schema_modal() {
  show_modal("#update_schema_modal", function(event) {
    handle_update_schema();
    return false;
  });
}

function handle_update_schema() {
  close_modal("#update_schema_modal");
  report_in_progress();
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'database.execute',
                 script: 'update-schema'},
          success: function(data) {
            report_success_xml(data);
          },
          error: function(event, jqXHR, ajaxSettings, thrownError) {
            report_failure(thrownError);
          }
         });
}



$(function () {
  $('input[name="connection_type"]').on('change', function() {
    val = $('input[name="connection_type"]:checked').val();
    // $('#for_string_connection').toggleClass('hidden', val != 'string');
    $('#connection_string').prop('disabled', val != 'string');
    hide_or_show_connection($('#for_odbc_connection'), val == 'odbc');
    hide_or_show_connection($('#for_mysql_connection'), val == 'mysql');
    hide_or_show_connection($('#for_sqlite_connection'), val == 'sqlite');
  });
  $('#odbc_dsn_name').on('keyup', function() {
    $('#connection_string').val('odbc:DSN=' + $(this).val() + ';Exclusive=NO');
  });
  $('#mysql_host').on('keyup', write_mysql_connection_string);
  $('#mysql_dbname').on('keyup', write_mysql_connection_string);
  $('#sqlite_path').on('keyup', update_sqlite_path);
});
