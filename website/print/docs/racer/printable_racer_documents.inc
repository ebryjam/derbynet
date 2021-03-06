<?php

function load_document_files_from($dir) {
  if (is_dir($dir)) {
    if ($dh = opendir($dir)) {
      while (($subdir = readdir($dh)) !== false) {
        if ($subdir !== "." && $subdir !== ".." && is_dir($dir . DIRECTORY_SEPARATOR . $subdir)) {
          require_once( $dir . DIRECTORY_SEPARATOR . $subdir . DIRECTORY_SEPARATOR . "document.inc" );
        }
      }
      closedir($dh);
    }
  }
}

abstract class PrintableRacerDocument {
  protected $pdf;
  protected $options;  // Contents vary by document type

  // Returns an array of key => {type:, desc:, default:}, with an entry for each
  // option key understood by the document class.
  //
  // type can be one of 'bool', 'string', 'int'.
  abstract function get_available_options();

  // Returns a name for the document class
  abstract function name();

  function set_options($options) {
    $this->options = $options;
  }

  function get_option($option) {
    if (isset($this->options[$option]))
      return $this->options[$option];
    $opts = $this->get_available_options();
    return $opts[$option]['default'];
  }

  abstract function StartDocument();

  // Argument contains these keys:
  //
  // racerid
  // firstname
  // lastname
  // carnumber
  // carname
  // class
  // classid
  // rank
  // rankid
  // imagefile
  // carphoto
  // barcode
  abstract public function DrawOne(&$racer);

  public function Output() {
    $this->pdf->Output();
  }

  protected function initialize_pdf($orientation, $unit, $size) {
    $this->pdf = new PDF_Combined($orientation, $unit, $size);
  }
}

load_document_files_from(dirname(__FILE__));

?>