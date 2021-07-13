# fed

fed.js v1.04 *very* minimal / lightweight inline rich text/HTML editor, plain javascript. fed = [f]esk's [ed]itor.
Copyright (c) 2021, Nick Besant hwf@fesk.net. All rights reserved.
licenced under GPLv3, see LICENCE.txt

NOTE: BY DEFAULT, THIS USES FONTAWESOME ICONS FOR ITS TOOLBAR.  YOU WILL NEED TO INCLUDE
FONTAWESOME ICONS IN YOUR PAGE, OR OVERRIDE fed_icons

usage:
include fed.js and fed.css on your page (make sure you also have FontAwesome's icons included);

```
<link href="/path/to/fed/fed.css" rel="stylesheet">
<script src="/path/to/fed/fed.js"></script>
let my_ed = new fed(divelement,{options});
```
Options info
```
      divelement can be queryselector string like #editor or .class, or a plain
              string which is assumed to be an ID, or a DOM element
      options is an object with;
              do_keybinding:bool (default true) - do/don't bind keys
              grabtab:bool (default false) - override default TAB behaviour.  Don't do this,
                                          it breaks accessibility even further.
              language:str (default en-GB) - a key in fed_strings
              strings:object (defaults to built-in fed_strings) - use to provide translated tips
              icons:object (defaults to built-in fed_icons) - replace icons (defaults to
                                          FontAwesome's basic icons).  You will need to make
                                          sure you include _icostart and _icoend keys.
              allow_sourceview:bool (default true) - show the view source button
              allow_images:bool   (default true) - show an image selector button
              img_max_size:int (default 1024*1024) - max size of individual image, if
                                          user adds a larger image, string 'image_too_big' is shown
                                          in the console, and 'error' callbacks (see .on()) are called.
              
```

highlights;

```
 .setcontents() and .getcontents() - set / get current content
 .on('edit',function(inst)) - add your function to be called when user makes an edit
 .destroy() - remove wrapper and toolbar and restore DIV back to original state
 .wrapper - the DIV element that wraps the toolbar and the edit content
 .toolbar - the toolbar DIV
 .content - the DIV containing the stuff being edited, this is the element you passed in the constructor
```
