function datalist_init(input) {
	var attrlist = input.getAttribute("list"), ellist = document.getElementById(attrlist);

	input.removeAttribute("list");
	input.autocomplete = "off";

	var cursel = null, items = [], mouse = true, // enable mouse event handling.
		datalist_match,
		dropdown = document.createElement("div"),
		prevmatches = [],
		prevvalue = null,
		url = input.getAttribute("data-url") || "",
		urlfn = input.getAttribute("data-urlfn") || "";
	dropdown.className = "datalist-dropdown";

	var getvalue = function(el) {
		return el.getAttribute("data-value") ||
			el.textContent || el.innerText;
	};

	var createitem = function(s) {
		var label, value, div = document.createElement("div");
		if (typeof(s) === "string") {
			label = value = s;
		} else {
			label = s.label;
			value = s.value;
		}

		div.innerHTML = label;
		div.setAttribute("data-value", value);
		div.addEventListener("mousedown", function() {
			input.value = getvalue(this);
			datalist_show(false);
		}, false);
		div.addEventListener("mousemove", function() {
			if (mouse)
				datalist_setsel(this);
		}, false);
		return { el: div, label: label, value: value };
	};

	if (url.length || urlfn.length) {
		urlfn = urlfn.length ? window[urlfn] : function(s) {
			return url + encodeURIComponent(s);
		};

		// "throttled" JSON XMLHttpRequest.
		var timer = null, prevurl = "";
		datalist_match = function(s, fn, ev) {
			clearTimeout(timer);

			url = urlfn(s);
			if (url === prevurl) {
				fn(prevmatches);
				return;
			}

			timer = setTimeout(function() {
				var x = new(XMLHttpRequest);
				x.onreadystatechange = function() {
					if (x.readyState != 4 || [ 0, 200 ].indexOf(x.status) == -1)
						return;

					prevmatches = [];
					var o = JSON.parse(x.responseText);
					for (var i = 0; i < o.length; i++)
						prevmatches.push(createitem(o[i]));

					prevurl = url;
					fn(prevmatches);
				};

				x.open("GET", url + "&t=" + String(new Date().getTime()), true);
				x.setRequestHeader("X-Requested-With", "XMLHttpRequest");
				x.timeout = 10000;
				x.send();
				// delay in ms: throttle request on change, but on focus/click open fast.
			}, ev == "onchange" ? 150 : 1);
		};
	} else {
		// use inline <datalist>.
		if (attrlist === null || ellist === undefined)
			return;
		for (var i = 0, ec = ellist.children, o; i < ec.length; i++) {
			var o = createitem(getvalue(ec[i]));
			o.search = o.label.toLowerCase().split(" ");
			items.push(o);
		}

		var datalist_filter = function(data, s) {
			var matches = [], tok = s.toLowerCase().split(" ");
			for (var i = 0; i < data.length; i++) {
				var fc = 0;
				for (var k = 0; k < tok.length && fc < tok.length; k++) {
					var f = false;
					for (var j = 0; j < data[i].search.length && fc < tok.length && !f; j++)
						for (var l = 0; l < data[i].search.length && !f; l++)
							if (data[i].search[l].indexOf(tok[k]) != -1)
								f = true;
					if (f)
						fc++;
				}
				// all tokens (separated by space) must match.
				if (fc == tok.length)
					matches.push(data[i]);
			}
			return matches;
		};

		datalist_match = function(s, fn) {
			s = s.toLowerCase();
			if (s === prevvalue) {
				fn(prevmatches);
				return;
			}

			// if token string is different or string not in previous search: use raw data,
			// else filter on existing data and no need to sort.
			if (prevvalue === null || (prevvalue.split(" ").length != s.split(" ").length) ||
			    s.indexOf(prevvalue) == -1)
				prevmatches = datalist_filter(items, s);
			else
				prevmatches = datalist_filter(prevmatches, s);
			prevvalue = s;
			fn(prevmatches);
		};
	}

	var datalist_render = function(m) {
		var dd = dropdown.cloneNode(false);
		var r = input.getClientRects() || [];
		if (r.length) {
			dd.style.left = String(r[0].left + window.pageXOffset) + "px";
			dd.style.top = String(r[0].top + input.offsetHeight + window.pageYOffset) + "px";
		}
		dd.style.minWidth = String(input.clientWidth) + "px";
		for (var i = 0; i < m.length; i++)
			dd.appendChild(m[i].el);
		dropdown.parentNode.replaceChild(dd, dropdown)
		dropdown = dd;
	};
	var datalist_visible = false;
	var datalist_show = function(status) {
		datalist_visible = status;
		dropdown.className = "datalist-dropdown " + (status ? "visible" : "");
	};
	var datalist_setsel = function(el) {
		if (cursel)
			cursel.className = "";
		cursel = el;
		if (el)
			el.className = "sel";
	};
	input.addEventListener("keydown", function(e) {
		mouse = false;
		switch (e.which) {
		case 13: // return
			if (cursel)
				input.value = getvalue(cursel);
			if (!datalist_visible)
				return;
			datalist_show(false);
			e.stopPropagation();
			return !!e.preventDefault();
		case 27: break; // escape
		case 33: // page up.
		case 34: // page down.
		case 38: // arrow up
		case 40: // arrow down
			var sel = cursel, dd = dropdown, dc = dropdown.children;

			// if last and down arrow switch to first item, if first and up arrow switch to last item.
			if (dc.length) {
				if (e.which == 38) { // up
					if (!sel || !(sel = sel.previousSibling))
						sel = dc[dc.length - 1];
				} else if (e.which == 40) { // down
					if (!sel || !(sel = sel.nextSibling))
						sel = dc[0];
				} else if (!sel) {
					sel = dc[0];
				}
			}
			if (cursel && (e.which == 33 || e.which == 34)) {
				var n = sel.offsetHeight ? (dd.clientHeight / sel.offsetHeight) : 0;
				if (e.which == 33) { // page up.
					for (; n > 0 && sel && sel.previousSibling;
						n--, sel = sel.previousSibling)
						;
				} else { // page down.
					for (; n > 0 && sel && sel.nextSibling;
						n--, sel = sel.nextSibling)
						;
				}
			}
			if (sel) {
				datalist_setsel(sel);

				// only update scroll if needed.
				if (sel.offsetTop < dd.scrollTop)
					dd.scrollTop = sel.offsetTop;
				else if (sel.offsetTop + sel.offsetHeight > dd.scrollTop + dd.offsetHeight)
					dd.scrollTop = sel.offsetTop;
			}
		}
	}, false);

	var onchange = function() {
		datalist_match(input.value, function(m) {
			// check if selection is still active in matches.
			if (cursel) {
				var hassel = false;
				for (var i = 0; i < m.length && !(hassel = (m[i].el === cursel)); i++)
					;
				if (!hassel)
					datalist_setsel(null);
			}
			// only one match? select it.
			if (m.length == 1)
				datalist_setsel(m[0].el);
			datalist_render(m);
			datalist_show(!!m.length);
		}, "onchange");
	};
	input.addEventListener("input", onchange);
	input.addEventListener("keyup", function(e) {
		mouse = true;
		switch (e.which) {
		case 13: // return
		case 27: // escape
			datalist_show(false);
		case 33: // page up.
		case 34: // page down.
		case 38: // arrow up
		case 40: // arrow down
			return;
		}
		onchange();
	}, false);
	input.addEventListener("focus", function() {
		datalist_setsel(null);
		datalist_match(input.value, function(m) {
			datalist_render(m);
			datalist_show(!!m.length);
			dropdown.scrollTop = 0; // reset scroll.
		});
	}, false);
	input.addEventListener("blur", function() {
		mouse = true;
		datalist_setsel(null);
		datalist_show(false);
	}, false);
	document.body.appendChild(dropdown);
}

var els = document.getElementsByClassName("datalist");
if (els !== null)
	for (var i = 0; i < els.length; i++)
		datalist_init(els[i]);
