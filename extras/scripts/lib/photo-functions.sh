#! /bin/sh
#
# This shared script provides definitions for several behaviors shared among the
# various photo scripts.


# The gvfs daemon conflicts with chdkptp and prevents correct operation of the script,
# so kill it if it's running.
killall_gvfs_volume_monitor() {
    NOW=`date +%s`
    DEADLINE=`expr $NOW + 120`
    # Keep going for two minutes, in case the daemon hasn't yet come up when we
    # try to kill it.  We don't want to commit resources to running this process
    # indefinitely, though.
    while [ `date +%s` \< $DEADLINE ] ; do
        sudo killall gvfs-gphoto2-volume-monitor > /dev/null 2>&1
        sleep 4s
    done &
}

# Try to log in to the derbynet server; keep trying until successful.
#
# This helps flush out connectivity problems and maybe password problems at the
# start of the script.
#
# Inputs from the environment:
#    DERBYNET_SERVER
#    PHOTO_USER
#    PHOTO_PASSWORD
#    COOKIES (path to cookie jar for both read and write)
do_login() {
    # If there are connectivity problems, keep trying until login is successful.
    LOGIN_OK=0
    while [ $LOGIN_OK -eq 0 ]; do
        echo Logging in to $DERBYNET_SERVER
        announce sending
        curl --location --data "action=login&name=$PHOTO_USER&password=$PHOTO_PASSWORD" \
             --silent --show-error -b "$COOKIES" -c "$COOKIES" -o - \
             "$DERBYNET_SERVER/action.php" \
            | grep -q success \
            && LOGIN_OK=1
        announce idle
        test $LOGIN_OK -eq 0 && sleep 1s
    done

    echo Successfully logged in
    announce login-ok
}

# Verifies that the barcode scanner device is connected; loops until successful.
#
# Input from the environment:
#    BARCODE_SCANNER_DEV   (a /dev path to the expected device)
check_scanner() {
    while [ ! -e "$BARCODE_SCANNER_DEV" ] ; do
        echo Scanner not connected
        announce no-scanner
    done
}

# If using chdkptp, loop until there is a camera connected.
#
# Input from the environment:
#    USE_CHDKPTP
check_camera() {
    # Connect to camera, set to picture-taking mode.  (This lets operator adjust
    # photo composition.)
    #
    # Assumes there's only one camera attached
    if [ $USE_CHDKPTP -ne 0 ] ; then
        echo Checking for camera
        while [ -z  "`chdkptp -elist`" ] ; do
            announce no-camera
        done
        echo Activating camera
        chdkptp -c -e"rec"
    fi
}

# If configured to do so, ask web server to check in the current racer.
#
# Inputs from the environment:
#    PHOTO_CHECKIN (boolean)
#    BARCODE (string read by barcode scanner)
#    DERBYNET_SERVER
#    COOKIES
# Outputs:
#    CHECKIN_OK (boolean, 1=ok)
maybe_check_in_racer() {
    if [ $PHOTO_CHECKIN -ne 0 -a "$BARCODE" != "PWDuploadtest" ] ; then
        echo Checking in racer $BARCODE at `date` | tee -a checkins.log
        # Check in the racer
        CHECKIN_OK=0
        curl --silent -F action=racer.pass \
             -F barcode=$BARCODE \
             -F value=1 \
             -b "$COOKIES" -c "$COOKIES" \
             "$DERBYNET_SERVER/action.php" \
            | tee -a checkins.log \
            | grep -q success && CHECKIN_OK=1
        if [ $CHECKIN_OK -eq 0 ] ; then
            echo Check-in failed | tee -a checkins.log
            tail checkins.log
            announce checkin-failed
        fi
    else
        CHECKIN_OK=1
    fi
}

# Try to upload one photo to the web server.
#
# The path to the photo is passed as an argument.
#
# Other inputs from the environment:
#    BARCODE
#    PHOTO_REPO
#    AUTOCROP
#    COOKIES
#    DERBYNET_SERVER
#    CHECKIN_OK (boolean describing success of check-in attempt, if any; 1=success)
upload_photo() {
    PHOTO_PATH="$1"
    echo Uploading $PHOTO_PATH for $BARCODE at `date` | tee -a uploads.log
    announce sending
    UPLOAD_OK=0
    curl --fail \
         -F action=photo.upload \
         -F MAX_FILE_SIZE=30000000 \
         -F repo=$PHOTO_REPO \
         -F barcode=$BARCODE \
         -F autocrop=$AUTOCROP \
         -F "photo=@$PHOTO_PATH;type=image/jpeg" \
         -b "$COOKIES" -c "$COOKIES" \
         "$DERBYNET_SERVER/action.php" \
        | tee -a uploads.log \
        | grep -q success && UPLOAD_OK=1

    if [ $UPLOAD_OK -eq 1 ] ; then
        if [ $CHECKIN_OK -eq 1 ] ; then
            announce idle
            sleep 0.5s
            announce success
        else
            announce upload-ok-but-checkin-failed
        fi
    else
        echo Upload failed | tee -a uploads.log
        tail uploads.log
        announce upload-failed
    fi
}

# Generate progressively larger local files of sorta-random bytes, and time the
# upload.
#
# Inputs from the environment:
#    COOKIES
#    DERBYNET_SERVER
upload_speed_test() {
    RANDOM_JPG=upload-test.random.jpg
    COUNT=25
    BS=2048

    dd if=/dev/urandom of=$RANDOM_JPG bs=$BS count=$COUNT status=none

    echo | tee -a uploads.log
    echo | tee -a uploads.log

    # The web server is normally configured for 8M uploads; larger will just
    # give errors.
    while [ `expr $COUNT \* $BS \* 2` -lt 8000000 ] ; do
        START=`date +%s`
        # At larger sizes, /dev/urandom can take several seconds, so we just
        # reuse the bytes we've already got.
        dd if=$RANDOM_JPG of=$RANDOM_JPG \
           seek=$COUNT bs=$BS count=$COUNT status=none
        END=`date +%s`

        COUNT=`expr $COUNT + $COUNT`
        [ `expr $END - $START` -ne 0 ] && \
            echo `expr $END - $START` "second(s) to double file to" $COUNT bytes | tee -a uploads.log

        BARCODE=PWDuploadtest
        START=`date +%s`
        curl --fail \
             -F action=photo.upload \
             -F MAX_FILE_SIZE=30000000 \
             -F repo=$PHOTO_REPO \
             -F barcode=$BARCODE \
             -F autocrop=0 \
             -F "photo=@$RANDOM_JPG;type=image/jpeg" \
             -b "$COOKIES" -c "$COOKIES" \
             "$DERBYNET_SERVER/action.php"
        END=`date +%s`

        echo `expr $END - $START` "second(s) to upload" `expr $COUNT \* $BS` bytes | tee -a uploads.log
        if [ `expr $END - $START` -ne 0 ] ; then
            SPEED=`expr \( $COUNT \* $BS \) / \( $END - $START \)`
            KB_SPEED=`expr $SPEED / 1000`
            echo $SPEED bytes per second | tee -a uploads.log
            echo $KB_SPEED Kb per second | tee -a uploads.log
            if [ $KB_SPEED -gt 200 ] ; then
                announce speed-good
            elif [ $KB_SPEED -gt 50 ] ; then
                announce speed-fair
            else
                announce speed-poor
            fi
            # Abandon the test if the trials are becoming impractical
            [ `expr $END - $START` -gt 10 ] && return
        fi

        echo | tee -a uploads.log
        echo | tee -a uploads.log
    done

    rm $RANDOM_JPG
    announce success
    wait
    [ -x /usr/bin/flite ] && flite -t "$KB_SPEED kilobytes per second"
}
