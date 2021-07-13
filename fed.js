//- fed.js v1.04 *very* minimal / lightweight inline rich text/HTML editor, plain javascript. fed = [f]esk's [ed]itor.
//- Copyright (c) 2021, Nick Besant hwf@fesk.net. All rights reserved.
//- licenced under GPLv3, see LICENCE.txt
//
// NOTE: BY DEFAULT, THIS USES FONTAWESOME ICONS FOR ITS TOOLBAR.  YOU WILL NEED TO INCLUDE
// FONTAWESOME ICONS IN YOUR PAGE, OR OVERRIDE fed_icons
//
// usage:
// include fed.js and fed.css on your page (make sure you also have FontAwesome's icons included);
// <link href="/path/to/fed/fed.css" rel="stylesheet">
// <script src="/path/to/fed/fed.js"></script>
//
// let my_ed = new fed(divelement,{options});
//      divelement can be queryselector string like #editor or .class, or a plain
//              string which is assumed to be an ID, or a DOM element
//      options is an object with;
//              do_keybinding:bool (default true) - do/don't bind keys
//              grabtab:bool (default false) - override default TAB behaviour.  Don't do this,
//                                          it breaks accessibility even further.
//              language:str (default en-GB) - a key in fed_strings
//              strings:object (defaults to built-in fed_strings) - use to provide translated tips
//              icons:object (defaults to built-in fed_icons) - replace icons (defaults to
//                                          FontAwesome's basic icons).  You will need to make
//                                          sure you include _icostart and _icoend keys.
//              allow_sourceview:bool (default true) - show the view source button
//              allow_images:bool   (default true) - show an image selector button
//              img_max_size:int (default 1024*1024) - max size of individual image, if
//                                          user adds a larger image, string 'image_too_big' is shown
//                                          in the console, and 'error' callbacks (see .on()) are called.
//
// highlights;
// .setcontents() and .getcontents() - set / get current content
// .on('TYPE',function(x))
//      .on('edit',function(){}) - add your function to be called when user makes an edit;
//      .on('error',function(msg){}) - add your function to be called when an error occurs;
// .destroy() - remove wrapper and toolbar and restore DIV back to original state
// .wrapper - the DIV element that wraps the toolbar and the edit content
// .toolbar - the toolbar DIV
// .content - the DIV containing the stuff being edited, this is the element you passed in the constructor

(function(){
    fed_strings = {
        'en-GB': {
            'viewhtml': "View HTML",
            'redo': "Redo",
            'undo': "Undo",
            'link': "Add/Remove Link",
            'image': "Add image",
            'formatremove': "Remove ALL Formatting",
            'header1': "Heading 1",
            'header2': "Heading 2",
            'header3': "Heading 3",
            'textnormal': "Normal",
            'olist': "Ordered List",
            'ulist': "Unordered List",
            'outdent': "Outdent",
            'indent': "Indent",
            'justifyleft': "Left Align",
            'justifycentre': "Centre Justify",
            'justifyright': "Right Align",
            'textcolour': "Text Colour",
            'fontbigger': "Larger",
            'fontsmaller': "Smaller",
            'underline': "Underscore",
            'italic': "Italic",
            'bold': "Bold",
            'prompt_url': "Enter URL",
            'image_too_big': "Image too large - maximum size: ",
        }
    }

    fed_icons = {
        '_icostart': '<i class="far fa-',
        '_icoend': '"></i>',
        'viewhtml': "code",
        'redo': "redo",
        'undo': "undo",
        'link': "link",
        'image': "image",
        'formatremove': "remove-format",
        'header1': "h1",
        'header2': "h2",
        'header3': "h3",
        'textnormal': "text",
        'olist': "list-ol",
        'ulist': "list-ul",
        'outdent': "outdent",
        'indent': "indent",
        'justifyleft': "align-left",
        'justifycentre': "align-justify",
        'justifyright': "align-right",
        'textcolour': "palette",
        'fontbigger': "plus-square",
        'fontsmaller': "minus-square",
        'underline': "underline",
        'italic': "italic",
        'bold': "bold",
    }

    fed = function(selector, opts){
        // set defaults for sanity
        this.debug=false;
        this.do_keybinding=true;
        this.language='en-GB';
        this.undo_buffer=[];
        this._selrange=null;
        this.grabtab=false;
        this.allow_sourceview=true;
        this.allow_images=true;
        this.img_max_size=1024 * 1024;
        this._legacy=false;
        if(opts){
            for(let o in opts){
                if(opts.hasOwnProperty(o)){
                    if(o==='debug'){this.debug=opts[o]}
                    if(o==='do_keybinding'){this.do_keybinding=opts[o]}
                    if(o==='strings'){fed_strings=opts[o]}
                    if(o==='language'){this.language=opts[o]}
                    if(o==='icons'){fed_icons=opts[o]}
                    if(o==='allow_sourceview'){this.allow_sourceview=opts[o]}
                    if(o==='allow_images'){this.allow_images=opts[o]}
                    if(o==='img_max_size'){this.img_max_size=opts[o]}
                }
            }
        }
        if(!fed_strings.hasOwnProperty(this.language)){
            throw "fed_strings is missing specified language: " + this.language;
        }

        // try to handle queryselector string, element name or dom object
        if(typeof selector==='string'||selector instanceof String){
            if(selector.substr(0,1)==='#'||selector.substr(0,1)==='.'){
                this.content = document.querySelector(selector);
            }else{
                this.content = document.getElementById(selector);
            }
        } else {
            this.content = selector;
        }

        if(this.content.tagName!=='DIV'){
            throw 'You must attach me to a DIV, otherwise I cannot work for you.  Bye.';
        }

        // my core bits
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('fed-wrap');
        this.toolbar = document.createElement('div');
        this.toolbar.classList.add('fed-tb');
        this.toolbar.setAttribute('tabindex', '-1');
        this.content.classList.add('fed-content');
        this.showing_html = false;

        // put me in the document
        this.content.parentNode.appendChild(this.wrapper);
        this.wrapper.appendChild(this.toolbar);
        this.wrapper.appendChild(this.content);

        // make my basis element editable
        this.content.setAttribute('contenteditable','true');

        // build toolbar
        tb_btn(this,'bold');
        tb_btn(this,'italic');
        tb_btn(this,'underline');
        tb_btn(this,'fontsmaller');
        tb_btn(this,'fontbigger');
        tb_btn(this,'textcolour');
        tb_sep(this);
        tb_btn(this,'justifyleft');
        tb_btn(this,'justifycentre');
        tb_btn(this,'justifyright');
        tb_btn(this,'indent');
        tb_btn(this,'outdent');
        tb_sep(this);
        tb_btn(this,'olist');
        tb_btn(this,'ulist');
        tb_sep(this);
        tb_btn(this,'textnormal');
        tb_btn(this,'header1');
        tb_btn(this,'header2');
        tb_btn(this,'header3');
        tb_sep(this);
        tb_btn(this,'formatremove');
        tb_sep(this);
        tb_btn(this,'link');
        if (this.allow_images){
            tb_btn(this,'image');
        }
        tb_sep(this);
        tb_btn(this,'undo');
        tb_btn(this,'redo');
        if(this.allow_sourceview) {
            tb_sep(this);
            tb_btn(this, 'viewhtml');
        }

        // trigger actions
        let me=this;

        // this seems overkill (you only attach to the whole document), but due to
        // the way we want the colour picker etc. to work, the selection is lost
        // after the click so we must store it for later use.
        this.selchange=document.addEventListener('selectionchange',function(){
            try{
                let r=window.getSelection().getRangeAt(0);
                if(r.startContainer.parentElement.closest('.fed-content')){
                    me._selrange=window.getSelection().getRangeAt(0);
                }
            }catch(e){
                me._legacy=true;
                me._selrange=null;
            }
        }, false);
        // perform actions on a button press.
        this.toolbar.addEventListener('click',function(e){
            let btn=e.target.closest('.fed-btn');
            if(btn!==null){
                action(me, btn.getAttribute('data-action'));
            }
        },false)

        // deal with file load and colour picker input events, restore the selection and
        // apply the colour.
        this.toolbar.addEventListener('input',function(e){
            let btn=e.target.closest('input');
            if(btn!==null&&btn.getAttribute('type')==='color'){
                e.preventDefault();
                if(me._selrange!==null){
                    document.getSelection().removeAllRanges();
                    document.getSelection().addRange(me._selrange);
                    let colin=me.toolbar.querySelector('.fed-colourbtn');
                    document.execCommand('foreColor', false, colin.value);
                }
            }else if(btn!==null&&btn.getAttribute('type')==='file'){
                e.preventDefault();
                let ifile = e.target.files[0],rdr=new FileReader();
                if(ifile.size>me.img_max_size){
                    let emsg=fed_strings[me.language]['image_too_big'];
                    if(ifile.size < 1000000){
                        emsg=emsg+Math.floor(ifile.size/1000) + 'KB';
                    }else{
                        emsg=emsg+Math.floor(ifile.size/1000000) + 'MB';
                    }
                    console.log('ERROR: '+emsg);
                    for(let x=0;x<me._callbacks.error.length;x++){
                        me._callbacks.error[x].call(me, emsg);
                    }
                    return;
                }

                rdr.addEventListener('load',function(){
                    let img=document.createElement('img');
                    img.setAttribute('src',rdr.result);
                    if(me._selrange!==null){
                        document.getSelection().removeAllRanges();
                        document.getSelection().addRange(me._selrange);
                        me._selrange.insertNode(img);
                    }else{
                        me.content.appendChild(img);
                    }

                },false);
                rdr.readAsDataURL(ifile);
            }

        },false)

        // events - 'edit' event is only emitted on keyup, paste or cut.
        // 'error' is emitted e.g. for image size limit
        this._callbacks = {
            edit:[],
            error:[]
        };
        this.on = function(eventtype, callback){
            if(!this._callbacks.hasOwnProperty(eventtype)){
                throw "Event type for 'on' unknown: "+eventtype;
            }
            this._callbacks[eventtype].push(callback);
        }

        // 'edit' event: listen for keyup, paste and cut. Listen on wrapper as the
        // editor may be removed/rebuilt which would remove any listeners.
        add_cb_event(me,'keyup','edit');
        add_cb_event(me,'paste','edit');
        add_cb_event(me,'cut','edit');

        // set my contents.  Don't care what state we were in, always reset to normal.
        this.setcontents = function(contents){
            let bts=me.toolbar.querySelectorAll('button');
            me.showing_html=false;
            for(let x=0;x<bts.length;x++){
                bts[x].disabled=false;
                bts[x].classList.remove('disabled');
            }
            me.content.innerHTML=contents;
            me.content.classList.remove('html');
            me.showing_html=false;
        }

        // Get my contents.  Get the inner HTML, even if we're in view-source mode.
        this.getcontents = function(){
            if(me.showing_html){
                let prebox=me.content.querySelector('.fed-pre');
                return prebox.textContent;
            }else{
                return me.content.innerHTML;
            }
        }

        // Die, and face the wrath of the binmen, possibly.  Should automagically remove
        // event listeners as we're removing the wrapper and toolbar.
        this.destroy = function(){
            let mycontent,mydiv=me.content;
            if(me.showing_html){
                let prebox=me.content.querySelector('.fed-pre');
                mycontent=prebox.textContent;
            }else{
                mycontent=me.content.innerHTML;
            }
            // Assume the element wasn't already contenteditable.
            me.content.removeAttribute('contenteditable');
            me.wrapper.parentNode.insertBefore(me.content, me.wrapper);
            me.wrapper.parentNode.removeChild(me.wrapper);
            document.removeEventListener('selectionchange', me.selchange);
        }

        // Grab keys
        if(this.do_keybinding){
            keybindings(this);
        }
    }

    function add_cb_event(inst, evt, src){
        inst.wrapper.addEventListener(evt,function(e){
            if(e.target.closest('.fed-content')){
                for(let x=0;x<inst._callbacks[src].length;x++){
                    if(inst.debug){
                        console.log("Sending 'edit' event to "+x);
                    }
                    inst._callbacks[src][x].apply(inst);
                }            }
        },false);
    }

    function action(inst, action){
        // We don't want the selection's parent if it's the main div,
        // and we don't want to make any doc style changes if we're not in the edit window
        let sele;
        if(inst._legacy){
            sele = window.getSelection().focusNode.parentNode;
        }else{
            sele = window.getSelection().focusNode.parentElement;
        }
        if(sele.classList.contains('fed-content')){sele=null}
        if(sele&&sele.closest('.fed-content')===null&&action!=='viewhtml'){return}
        if(inst.debug){console.log("action: "+action)}
        switch(action){
            case 'bold':
                document.execCommand('bold', false, '');
                break;
            case 'italic':
                document.execCommand('italic', false, '');
                break;
            case 'underline':
                document.execCommand('underline', false, '');
                break;
            case 'fontsmaller':
                // increasefontsize / decrease don't work well cross-browser
                if(sele){
                    let currfs = parseInt(getComputedStyle(sele).fontSize);
                    if(currfs>1){
                        sele.style.fontSize = (currfs - 1) + 'px';
                    }
                }
                break;
            case 'fontbigger':
                // increasefontsize / decrease don't work well cross-browser
                if(sele){
                    let currfs = parseInt(getComputedStyle(sele).fontSize);
                    sele.style.fontSize = (currfs + 1) + 'px';
                }
                break;
            case 'olist':
                document.execCommand('insertOrderedList', false, '');
                break;
            case 'ulist':
                document.execCommand('insertUnorderedList', false, '');
                break;
            case 'header1':
                document.execCommand('formatBlock', false, 'h1');
                break;
            case 'header2':
                document.execCommand('formatBlock', false, 'h2');
                break;
            case 'header3':
                document.execCommand('formatBlock', false, 'h3');
                break;
            case 'textnormal':
                document.execCommand('formatBlock', false, 'p');
                break;
            case 'formatremove':
                // replace all <br>, <br/>, </p>, </div> with [BR]
                // very slow and obvious method
                inst.undo_buffer.push(inst.content.innerHTML);
                let intc = inst.content.innerHTML.replace('<br>', '[BR]');
                intc = intc.replaceAll('<BR>', '[BR]');
                intc = intc.replaceAll('<br/>', '[BR]');
                intc = intc.replaceAll('<BR/>', '[BR]');
                intc = intc.replaceAll('</p>', '[BR]');
                intc = intc.replaceAll('</P>', '[BR]');
                intc = intc.replaceAll('</div>', '[BR]');
                intc = intc.replaceAll('</DIV>', '[BR]');
                intc = intc.replaceAll(/<(.|\n)*?>/g, '');
                intc = intc.replaceAll('[BR]', '<br>');
                inst.content.innerHTML='<div>\n'+intc+'\n</div>';
                break;
            case 'justifyleft':
                document.execCommand('justifyLeft',false,'');
                break;
            case 'justifycentre':
                document.execCommand('justifyCenter',false,'');
                break;
            case 'justifyright':
                document.execCommand('justifyRight',false,'')
                break;
            case 'indent':
                document.execCommand('indent',false,'')
                break;
            case 'outdent':
                document.execCommand('outdent',false,'')
                break;
            case 'undo':
                // poor attempt and gives inconsistent results, but least-code/best-fit for now
                if(inst.undo_buffer.length){
                    if(inst.showing_html){
                        let prebox=inst.content.querySelector('.fed-pre');
                        prebox.innerHTML=inst.undo_buffer.pop();
                    }else{
                        inst.content.innerHTML=inst.undo_buffer.pop();
                    }
                }else{
                    document.execCommand('undo',false,'');
                }
                break;
            case 'redo':
                document.execCommand('redo',false,'');
                break;
            case 'link':
                if (sele&&sele.tagName === "A") {
                    document.execCommand('unlink', false, '');
                } else {
                    let givenurl = prompt(fed_strings[inst.language]['prompt_url']);
                    if (givenurl != null) {
                        document.execCommand('createLink', false, givenurl);
                    }
                }
                break;
            case 'image':
                break;
            case 'textcolour':
                break;
            case 'viewhtml':
                let bts=inst.toolbar.querySelectorAll('button');
                if(inst.showing_html){
                    let prebox=inst.content.querySelector('.fed-pre');
                    // take the textContent (NOT innerHTML etc.) and make it the
                    // innerHTML for the original editor (will overwrite the pre)
                    inst.content.innerHTML=prebox.textContent;
                    inst.showing_html=false;
                    inst.content.classList.remove('html');
                    // make buttons work again
                    for(let x=0;x<bts.length;x++){
                        bts[x].disabled=false;
                        bts[x].classList.remove('disabled');
                    }
                    inst.content.setAttribute('contenteditable','true');
                    inst.content.focus();
                }else{
                    let h_ents=[],raw=inst.content.innerHTML,
                        container=document.createElement('pre');
                    for(let x=0;x<raw.length;x++){
                        // get character code for every char in raw, build/concat
                        // to make into a str(html entity) e.g. &#47; (>), push onto list
                        h_ents.push('&#'+raw[x].charCodeAt()+';');
                    }
                    // this means we're setting the contents to a bunch of entities and not
                    // their node/element objects.
                    container.innerHTML=h_ents.join('');
                    // remove and re-set contenteditable, as otherwise some browsers
                    // won't allow edits to the pre container
                    container.setAttribute('contenteditable','true');
                    container.classList.add('fed-pre');
                    inst.content.innerText='';
                    inst.content.setAttribute('contenteditable','false');
                    inst.content.appendChild(container);
                    inst.showing_html=true;
                    inst.content.classList.add('html');
                    // stop all other buttons from working
                    for(let x=0;x<bts.length;x++){
                        if(bts[x].getAttribute('data-action')!=='viewhtml'){
                            bts[x].disabled=true;
                            bts[x].classList.add('disabled');
                        }
                    }
                    container.focus();
                }
                break;
            default:
                break;
        }
    }

    // vertical separator block in toolbar
    function tb_sep(inst){
        let sep = document.createElement('div');
        sep.classList.add('fed-sep');
        inst.toolbar.appendChild(sep);

    }

    // create a button in toolbar
    function tb_btn(inst, action){
        let btn;
        if(action==='textcolour') {
            // colour picker is hidden and activated by label click
            let sbtn = document.createElement('input'),bid=makeid();
            sbtn.setAttribute('type', 'color');
            sbtn.setAttribute('id',bid);
            sbtn.setAttribute('tabindex','0');
            sbtn.classList.add('fed-colourbtn');
            inst.toolbar.appendChild(sbtn);

            btn = document.createElement('label');
            btn.setAttribute('for',bid);
            btn.classList.add('fed-colourfore');
            btn.innerHTML = fed_icons["_icostart"] + fed_icons[action] + fed_icons["_icoend"];

        }else if(action==='image') {
            // image file input is hidden and activated by label click
            let sbtn = document.createElement('input'),bid=makeid();
            sbtn.setAttribute('type', 'file');
            sbtn.setAttribute('accept','image/*');
            sbtn.setAttribute('id',bid);
            sbtn.setAttribute('tabindex','0');
            sbtn.classList.add('fed-filebtn');
            inst.toolbar.appendChild(sbtn);

            btn = document.createElement('label');
            btn.setAttribute('for',bid);
            btn.classList.add('fed-filefore');
            btn.innerHTML = fed_icons["_icostart"] + fed_icons[action] + fed_icons["_icoend"];

        }else{
            btn = document.createElement('button');
            btn.innerHTML=fed_icons["_icostart"]+fed_icons[action]+fed_icons["_icoend"];
        }
        btn.classList.add('fed-btn');
        btn.setAttribute('data-tooltip', fed_strings[inst.language][action]);
        btn.setAttribute('aria-label', fed_strings[inst.language][action]);
        btn.setAttribute('aria-hidden', 'true');
        btn.setAttribute('tabindex','0');
        btn.setAttribute('data-action', action);
        inst.toolbar.appendChild(btn);
    }

    function makeid(){
        let t="",l="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for(let i=0;i<12;i++){
            t+=l.charAt(Math.floor(Math.random()*l.length));
        }
        return t;
    }

    // bind certain keys - e.g. ctrl-b as otherwise they'll perform the default
    // browser actions
    function keybindings(inst) {
        inst.content.addEventListener("keydown", function(e) {
            if(inst.debug){
                if(e.metaKey === true || e.ctrlKey === true) {
                    console.log("CTRL/CMD+"+e.keyCode);
                }else{
                    console.log(e.keyCode);
                }
            }
            // tab
            if(e.keyCode === 9&&inst.grabtab) {
                e.preventDefault();
                let doc = inst.content.ownerDocument.defaultView,
                    sel = doc.getSelection(),
                    range = sel.getRangeAt(0),
                    tabNode = document.createTextNode("\u00a0\u00a0\u00a0\u00a0");
                range.insertNode(tabNode);
                range.setStartAfter(tabNode);
                range.setEndAfter(tabNode);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            // i = italic
            if(e.keyCode === 73) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'italic');
                }
            }

            // u = underline
            if(e.keyCode === 85) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'underline');
                }
            }

            // b = bold
            if(e.keyCode === 66) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'bold');
                }
            }

            // 1 = h1
            if(e.keyCode === 49) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'header1');
                }
            }

            // 2 = h2
            if(e.keyCode === 50) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'header2');
                }
            }

            // 3 = h3
            if(e.keyCode === 51) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'header3');
                }
            }

            // Z - undo
            if(e.keyCode === 90) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'undo');
                }
            }

            // Y - redo
            if(e.keyCode === 89) {
                if(e.metaKey === true || e.ctrlKey === true) {
                    e.preventDefault();
                    action(inst,'redo');
                }
            }

        }, false);
    }

})();
