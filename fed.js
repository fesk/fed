//- fed.js v1.02 *very* minimal / lightweight inline rich text/HTML editor, plain javascript. fed = [f]esk's [ed]itor.
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
//              language:str (default en-GB) - a key in fed_strings
//              strings:object (defaults to built-in fed_strings) - use to provide translated tips
//              icons:object (defaults to built-in fed_icons) - replace icons (defaults to
//                                          FontAwesome's basic icons).  You will need to make
//                                          sure you include _icostart and _icoend keys.
//
// highlights;
// .setcontents() and .getcontents() - set / get current content
// .on('edit',function(inst)) - add your function to be called when user makes an edit
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
        }
    }

    fed_icons = {
        '_icostart': '<i class="far fa-',
        '_icoend': '"></i>',
        'viewhtml': "code",
        'redo': "redo",
        'undo': "undo",
        'link': "link",
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
        this.debug=false;
        this.do_keybinding=true;
        this.language='en-GB';
        this.undo_buffer=[];
        if(opts){
            for(let o in opts){
                if(opts.hasOwnProperty(o)){
                    if(o==='debug'){this.debug=opts[o]}
                    if(o==='do_keybinding'){this.do_keybinding=opts[o]}
                    if(o==='strings'){fed_strings=opts[o]}
                    if(o==='language'){this.language=opts[o]}
                    if(o==='icons'){fed_icons=opts[o]}
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
        tb_sep(this);
        tb_btn(this,'undo');
        tb_btn(this,'redo');
        tb_sep(this);
        tb_btn(this,'viewhtml');

        // trigger actions
        let me=this;
        this.toolbar.addEventListener('click',function(e){
            let btn=e.target.closest('.fed-btn');
            if(btn!==null){
                action(me, btn.getAttribute('data-action'));
            }
        },false)
        this.toolbar.addEventListener('input',function(e){
            let btnc=e.target.closest('input');
            if(btnc!==null){
                let colin=me.toolbar.querySelector('.fed-colourbtn');
                document.execCommand('foreColor', false, colin.value);
            }
        },false)

        // events - only an 'edit' event is emitted on keyup, paste or cut
        this._callbacks = {edit:[]};
        this.on = function(eventtype, callback){
            if(!this._callbacks.hasOwnProperty(eventtype)){
                throw "Event type for 'on' unknown: "+eventtype;
            }
            this._callbacks[eventtype].push(callback);
        }

        // 'edit' event: listen for keyup, paste and cut. Listen on wrapper as the
        // editor may be removed/rebuilt which would remove any listeners
        this.wrapper.addEventListener('keyup',function(e){
            if(e.target.closest('.fed-content')){
                for(let x=0;x<me._callbacks.edit.length;x++){
                    me._callbacks.edit[x].apply(me);
                }
            }
        },false);
        this.wrapper.addEventListener('paste',function(e){
            if(e.target.closest('.fed-content')){
                for(let x=0;x<me._callbacks.edit.length;x++){
                    me._callbacks.edit[x].apply(me);
                }            }
        },false);
        this.wrapper.addEventListener('cut',function(e){
            if(e.target.closest('.fed-content')){
                for(let x=0;x<me._callbacks.edit.length;x++){
                    me._callbacks.edit[x].apply(me);
                }            }
        },false);

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

        // Die, and face the wrath of the GC, possibly.  Should automagically remove
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
            me.wrapper.replaceChild(me.content,me.wrapper);
        }

        // Grab keys
        if(this.do_keybinding){
            keybindings(this);
        }
    }

    function action(inst, action){
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
                document.execCommand('decreaseFontSize', false, '');
                break;
            case 'fontbigger':
                document.execCommand('increaseFontSize', false, '');
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
                intc = intc.replaceAll('[BR]', '<br/>');
                inst.content.innerHTML=intc;
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
                let sele = window.getSelection().focusNode.parentElement;
                if (sele&&sele.tagName === "A") {
                    document.execCommand('unlink', false, '');
                } else {
                    const linkURL = prompt('Enter URL');
                    if (linkURL != null) {
                        document.execCommand('createLink', false, linkURL);
                    }
                }
                break;
            case 'textcolour':
                let cbtn=inst.toolbar.querySelector('.fed-colourbtn');
                // click works as we're falling through from a pointer event
                cbtn.click();
                break;
            case 'viewhtml':
                let bts=inst.toolbar.querySelectorAll('button');
                if(inst.showing_html){
                    let prebox=inst.content.querySelector('.fed-pre');
                    inst.content.innerHTML=prebox.textContent;
                    inst.showing_html=false;
                    inst.content.classList.remove('html');
                    for(let x=0;x<bts.length;x++){
                        bts[x].disabled=false;
                        bts[x].classList.remove('disabled');
                    }
                }else{
                    let current_content=htmlentities.encode(inst.content.innerHTML);
                    let container=document.createElement('pre');
                    container.classList.add('fed-pre');
                    container.innerHTML=current_content;
                    inst.content.innerText='';
                    inst.content.appendChild(container);
                    inst.showing_html=true;
                    inst.content.classList.add('html');
                    for(let x=0;x<bts.length;x++){
                        if(bts[x].getAttribute('data-action')!=='viewhtml'){
                            bts[x].disabled=true;
                            bts[x].classList.add('disabled');
                        }
                    }
                }
                break;
            default:
                break;
        }
    }

    const htmlentities = {
            encode : function(str) {
                let buf = [];
                for (let i=str.length-1;i>=0;i--) {
                    buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
                }
                return buf.join('');
            },
            decode : function(str) {
                return str.replace(/&#(\d+);/g, function(match, dec) {
                    return String.fromCharCode(dec);
                });
            }
        };

    function tb_sep(inst){
        let sep = document.createElement('div');
        sep.classList.add('fed-sep');
        inst.toolbar.appendChild(sep);

    }

    function tb_btn(inst, action){
        let btn = document.createElement('button');
        btn.classList.add('fed-btn');
        btn.innerHTML=fed_icons["_icostart"]+fed_icons[action]+fed_icons["_icoend"];
        btn.setAttribute('data-tooltip', fed_strings[inst.language][action]);
        btn.setAttribute('tabindex','-1');
        btn.setAttribute('data-action', action);
        if(action==='textcolour'){
            colour_btn=document.createElement('input');
            colour_btn.setAttribute('type','color');
            colour_btn.classList.add('fed-colourbtn');
            inst.toolbar.appendChild(colour_btn);
        }
        inst.toolbar.appendChild(btn);

    }

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
            if(e.keyCode === 9) {
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
