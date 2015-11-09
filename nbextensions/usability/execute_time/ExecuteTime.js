
//  Copyright (C) 2014  Jean-Christophe Jaskula
//
//  Distributed under the terms of the BSD License.
//----------------------------------------------------------------------------
//
// Execute timings - display when a cell has been executed lastly and how long it took
// A double click on the box makes it disappear
define(["require", "jquery", "base/js/namespace", "base/js/events"], function (require, $, IPython, events) {
    "use strict";

    var firstExecTime=null;
    var execCells=[];
    var toggle_all = null;

    var month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var day_names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    // if it's longer than this number of seconds, play a sound.
    var LONG_DURATION = 10
    var ding = new Audio('/nbextensions/usability/execute_time/ding.mp3'),
        ticking = new Audio('/nbextensions/usability/execute_time/ticking.mp3'),
        tickTimeout;


    ticking.loop = true;

    var patchCodecellExecute = function() {
        console.log('patching codecell to trigger ExecuteCell.ExecuteTime');
        IPython.CodeCell.prototype.old_execute = IPython.CodeCell.prototype.execute;

        IPython.CodeCell.prototype.execute = function () {
            this.old_execute(arguments);
            events.trigger('ExecuteCell.ExecuteTime');
        };
    }

    var toggleDisplay = function() {
        var cell = IPython.notebook.get_selected_cell(); // get the selected cell
        if (cell instanceof IPython.CodeCell) {
            var ce=cell.element;

            var timing_area=ce.find(".timing_area");
            var vis=timing_area.is(':visible');
            if (vis) {
                ce.find(".input_area").css('border-radius','4px');
                timing_area.hide();
            } else {
                ce.find(".input_area").css('border-radius','4px 4px 0 0');
                timing_area.show();
            }
        }
    };

    var create_menu = function() {
        var link_current=$("<a/>").text("Current").click(toggleDisplay);

        var link_all=$("<a/>").text("All").click(function(){
            var ncells = IPython.notebook.ncells()
            var cells = IPython.notebook.get_cells();
            for (var i=0; i<ncells; i++) {
                if (cells[i] instanceof IPython.CodeCell) {
                    var timing_area=(cells[i]).element.find(".timing_area");
                    var vis=timing_area.is(':visible');
                    if (!timing_area.length)
                        continue;

                    if (toggle_all === null)
                        toggle_all= vis;
                    if (toggle_all) {
                        (cells[i]).element.find(".input_area").css('border-radius','4px');
                        timing_area.hide();
                    } else {
                        (cells[i]).element.find(".input_area").css('border-radius','4px 4px 0 0');
                        timing_area.show();
                    }
                }
            }
            toggle_all=null;
        });

        var cmenu=$("body").find("ul#cell_menu");
        var toggle_timings_menu=$("<li/>").addClass("dropdown-submenu").attr("id","toggle_timings").append($("<a/>").text("Toggle timings"));
        cmenu.append(toggle_timings_menu);
        var timings_submenu=$("<ul/>").addClass("dropdown-menu");
        var toggle_current_timings=$("<li/>").attr({id:"toggle_current_timings", title:"Toggle the current cell timings box"}).append(link_current);
        var toggle_all_timings=$("<li/>").attr({id:"toggle_all_timings", title:"Toggle all timings box"}).append(link_all);
        timings_submenu.append(toggle_current_timings).append(toggle_all_timings);
        toggle_timings_menu.append(timings_submenu);
    }

    var date_fmt = function(date) {
        var dnames=day_names[date.getDay()] + "";
        var mon=month_names[date.getMonth()] + " ";
        var day=date.getDate() +" ";
        var year= date.getFullYear()+" ";

        var hour = date.getHours();
        var a_p = (hour < 12) ? "AM" : "PM";

        hour = (hour == 0) ? 12 : hour;
        hour = (hour > 12) ? hour - 12 : hour;

        var min = date.getMinutes() + "";
        min = (min.length == 1) ? "0" + min: min;

        return dnames+ ', ' + mon + day + year + 'at ' + hour + ":" + min + " " + a_p;
    }

    var executionStartTime = function (event) {
        var cell = IPython.notebook.get_selected_cell(); // get the selected cell
        if (cell instanceof IPython.CodeCell) {
            var ce=cell.element;

            var execTime=new Date();

            if (firstExecTime === null)
                firstExecTime=execTime;
            execCells.push([IPython.notebook.get_selected_index()]);

            var startMsg = 'Last executed on <span class="date_string">' + date_fmt(execTime) + '</span>';

            var start_area=ce.find(".start_area");
            if (start_area.length === 0) {
                var timing_area = $('<div/>').addClass('timing_area'),
                    duration_area = $('<div/>').addClass('duration_area'),
                    start_area = $('<div/>').addClass('start_area');

                timing_area.append(duration_area);
                timing_area.append(start_area);
                timing_area.dblclick(toggleDisplay);

                ce.find(".input_area").css('border-radius','4px 4px 0 0');
                ce.find(".inner_cell").append(timing_area);
            }
            start_area.html(startMsg);

            tickTimeout = window.setTimeout(function(){
                ticking.play();
            }, LONG_DURATION * 1000);
        }
    };

    var executionEndTime = function(event) {
        window.clearTimeout(tickTimeout);
        ticking.pause();

        if (firstExecTime === null) {
            return;
        }

        var cellNb=execCells.shift();

        var cell = IPython.notebook.get_cell(cellNb); // get the selected cell
        if (cell instanceof IPython.CodeCell) {

            var endExecTime=new Date();

            var UnixBeforeExec = Math.round(firstExecTime.getTime()/1000);
            var end = Math.round(endExecTime.getTime()/1000);
            var ET = (end-UnixBeforeExec);

            var hours=Math.floor(ET/3600);
            var minutes=Math.floor((ET-hours*3600)/60);
            var seconds=Math.floor(ET-hours*3600-minutes*60);
            var durationMsg = seconds + ' s';
            if (minutes) {
                durationMsg = minutes + ' min ' + durationMsg;
            }
            if (hours) {
                durationMsg = hours + ' h ' + durationMsg;
            }
            if(ET < 1){
                durationMsg = 'instant';
            } else if (ET < LONG_DURATION){
                durationMsg = 'fast <span class="duration_string">' + durationMsg + '<span>';

            } else if (ET < LONG_DURATION * 10){
                durationMsg = 'med  <span class="duration_string">' + durationMsg + '<span>';
            } else {
                durationMsg = 'slow <span class="duration_string">' + durationMsg + '<span>';
            }

            var da=cell.element.find("div.duration_area"),
                ta=cell.element.find("div.timing_area");

            da.html(durationMsg);
            ta.hide();
            ta.show('highlight', {color:'#c000c0'}, 1000);

            if(ET > LONG_DURATION){
                // play a sound
                ding.play();
            }

            if (!execCells.length) {
                firstExecTime=null;
            } else {
                firstExecTime=endExecTime;
            }
        }
    };

    var load_ipython_extension = function() {
        patchCodecellExecute();

        events.on('ExecuteCell.ExecuteTime', executionStartTime);
        events.on('kernel_idle.Kernel', executionEndTime);

        $("head").append($("<link rel='stylesheet' href='" + require.toUrl("./ExecuteTime.css") + "' type='text/css'  />"));
        create_menu();
    };

    var extension = {
        load_ipython_extension : load_ipython_extension
    };
    return extension;
});
