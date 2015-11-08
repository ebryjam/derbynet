<?php @session_start();
require_once('inc/authorize.inc');

require_permission(SET_UP_PERMISSION);
?>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>DerbyNet Set-Up</title>
<?php require('inc/stylesheet.inc'); ?>
<link rel="stylesheet" type="text/css" href="css/jquery.mobile-1.4.2.css"/>
<link rel="stylesheet" type="text/css" href="css/coordinator.css"/>
<link rel="stylesheet" type="text/css" href="css/setup.css"/>
<script type="text/javascript" src="js/jquery.js"></script>
<script type="text/javascript" src="js/jquery-ui-1.10.4.min.js"></script>
<script type="text/javascript">
// We're using jQuery Mobile for its nice mobile/tablet-friendly UI
// elements.  By default, jQM also wants to hijack page loading
// functionality, and perform page loads via ajax, a "service" we
// don't really want.  Fortunately, it's possible to turn that stuff
// off.
$(document).bind("mobileinit", function() {
                                   $.extend($.mobile, {
                                         ajaxEnabled: false
                                         });
                                 });
</script>
<!-- For flipswitch and select elements: -->
<script type="text/javascript" src="js/jquery.mobile-1.4.2.min.js"></script>
<script type="text/javascript" src="js/dashboard-ajax.js"></script>
<script type="text/javascript" src="js/modal.js"></script>
<script type="text/javascript" src="js/setup.js"></script>
</head>
<body>
<?php $banner_title = 'Set-Up'; require('inc/banner.inc'); ?>
<h3>Current Configuration File</h3>
<?php

$local_config_inc = 'local'.DIRECTORY_SEPARATOR.'config-database.inc';
$offer_config_button = true;

if (file_exists($local_config_inc)) {
  echo "<pre>\n";
  echo htmlspecialchars(file_get_contents($local_config_inc,
                                          /* use_include_path */ true),
                        ENT_QUOTES, 'UTF-8');
  echo "</pre>\n";
  try {
    @include($local_config_inc);
  } catch (PDOException $p) {
    echo '<p>Configuration file fails to load correctly.</p>';
  }
} else {
  echo "<p>You do not yet have a local configuration file.</p>\n";

  if (!is_dir('local')) {
    $path = str_replace("setup.php", "local/", $_SERVER['SCRIPT_FILENAME']);
    echo "<p>You need to create a <b>'".$path."'</b> directory, and make it writable.</p>\n";
    $offer_config_button = false;
  } else if (!is_writable('local')) {
    $path = str_replace("setup.php", "local/", $_SERVER['SCRIPT_FILENAME']);
    echo "<p>The <b>'".$path."'</b> directory exists, but isn't writable.</p>\n";
    $offer_config_button = false;
  }
}

if ($offer_config_button) {
?>
<div class="block_buttons">
    <input type="button" data-enhanced="true" value="Configure" onclick="show_choose_database_modal()"/><br/>
</div>
<?php
}

if (isset($db) && $db) {
  require_once('inc/data.inc');
  require_once('inc/schema_version.inc');

  try {
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $db->prepare('SELECT COUNT(*) from RegistrationInfo');
    $stmt->execute(array());
    $row = $stmt->fetch(PDO::FETCH_NUM);
    $stmt->closeCursor();
    echo '<p>There are '.$row[0].' racer(s) registered.</p>';
  } catch (PDOException $p) {
    echo '<p>Unable to query RegistrationInfo table.</p>';
  }
?>
<div class="block_buttons">
    <input type="button" data-enhanced="true"
           value="Initialize Schema" onclick="show_initialize_schema_modal()"/>
    <br/>
<?php

    try {
        echo '<p>Schema version '.schema_version().' (expecting version '.expected_schema_version().')</p>'."\n";
        if (schema_version() < expected_schema_version()) {
?>
    <input type="button" data-enhanced="true"
           value="Update Schema" onclick="show_update_schema_modal()"/>
    <br/>
<?php
        }
    } catch (PDOException $p) {
        echo '<p>Can\'t determine schema version (expecting version '.expected_schema_version().')</p>'."\n";
    }

?>

</div>
<?php
}

?>
<?php
function label_driver_check($driver) {
  // TODO: Make this a link to a troubleshooting page
  if (!in_array($driver, pdo_drivers())) {
    echo " <span class=\"missing_driver\">(Driver not loaded!)</span>";
  }
}
?>

<div id="choose_database_modal" class="modal_dialog wide_modal tall_modal hidden block_buttons">
  <form>
    <input type="radio" name="connection_type" value="string" id="string_connection"
           checked="checked" data-wrapper-class="string_connection_wrapper"/>
    <label for="string_connection">Arbitrary connection string</label>
    <input type="radio" name="connection_type" value="odbc" id="odbc_connection"
           data-wrapper-class="odbc_connection_wrapper"/>
    <label for="odbc_connection">ODBC data source<?php label_driver_check("odbc");?></label>
    <input type="radio" name="connection_type" value="mysql" id="mysql_connection"
           data-wrapper-class="mysql_connection_wrapper"/>
    <label for="mysql_connection">MySQL data source<?php label_driver_check("mysql"); ?></label>
    <input type="radio" name="connection_type" value="sqlite" id="sqlite_connection"
           data-wrapper-class="sqlite_connection_wrapper"/>
    <label for="sqlite_connection">SQLite data source<?php label_driver_check("sqlite"); ?></label>

    <div id="for_odbc_connection" class="hidden odbc_connection_wrapper">
        <label for="odbc_dsn_name">ODBC data source name (DSN):</label>
        <input type="text" name="odbc_dsn_name" id="odbc_dsn_name"/>
    </div>

    <div id="for_mysql_connection" class="hidden mysql_connection_wrapper">
        <label for="mysql_host">MySQL Host:</label>
        <input type="text" name="mysql_host" id="mysql_host" value="localhost"/>
        <label for="mysql_dbname">MySQL database name:</label>
        <input type="text" name="mysql_dbname" id="mysql_dbname"/>
    </div>

    <div id="for_sqlite_connection" class="hidden sqlite_connection_wrapper">
        <label for="sqlite_path">Path (on server) to SQLite data file:</label>
        <input type="text" name="sqlite_path" id="sqlite_path"/>
    </div>

    <div id="for_string_connection" class="string_connection_wrapper">
        <label for="connection_string">Database connection string:</label>
        <input type="text" name="connection_string" id="connection_string"
               placeholder="Database connection string"/>
    </div>

    <label for="dbuser">Database user name:</label>
    <input type="text" name="dbuser" id="username_field"/>
    <label for="dbpass">Database password:</label>
    <input type="text" name="dbpass" id="password_field"/>

    <input type="submit" data-enhanced="true" value="Submit"/>
    <input type="button" data-enhanced="true" value="Cancel"
      onclick='close_modal("#choose_database_modal");'/>
  </form>
</div>

<div id="initialize_schema_modal" class="modal_dialog hidden block_buttons">
  <form>

    <p>Initializing the schema will wipe out any existing data in the 
    database, and cannot be undone.  Are you sure that's what you want to do?</p>

    <input type="submit" data-enhanced="true" value="Initialize"/>
    <input type="button" data-enhanced="true" value="Cancel"
      onclick='close_modal("#initialize_schema_modal");'/>
  </form>
</div>

<div id="update_schema_modal" class="modal_dialog hidden block_buttons">
  <form>

    <p>Updating the schema may affect any existing data in the 
    database, and cannot be undone.  Are you sure that's what you want to do?</p>

    <input type="submit" data-enhanced="true" value="Update Schema"/>
    <input type="button" data-enhanced="true" value="Cancel"
      onclick='close_modal("#update_schema_modal");'/>
  </form>
</div>

</body>
</html>