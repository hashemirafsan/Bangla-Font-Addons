
/*================
Jquery ime js
=================*/
( function ( $ ) {
	'use strict';

	function IME( element, options ) {
		this.$element = $( element );
		// This needs to be delayed here since extending language list happens at DOM ready
		$.ime.defaults.languages = arrayKeys( $.ime.languages );
		this.options = $.extend( {}, $.ime.defaults, options );
		this.active = false;
		this.inputmethod = null;
		this.language = null;
		this.context = '';
		this.selector = this.$element.imeselector( this.options );
		this.listen();
	}

	IME.prototype = {
		constructor: IME,

		listen: function () {
			this.$element.on( 'keypress.ime', $.proxy( this.keypress, this ) );
		},

		/**
		 * Transliterate a given string input based on context and input method definition.
		 * If there are no matching rules defined, returns the original string.
		 *
		 * @param input
		 * @param context
		 * @param altGr bool whether altGr key is pressed or not
		 * @returns String transliterated string
		 */
		transliterate: function ( input, context, altGr ) {
			var patterns, regex, rule, replacement, i;

			if ( altGr ) {
				patterns = this.inputmethod.patterns_x || [];
			} else {
				patterns = this.inputmethod.patterns;
			}

			if ( $.isFunction( patterns ) ) {
				return patterns.call( this, input, context );
			}

			for ( i = 0; i < patterns.length; i++ ) {
				rule = patterns[i];
				regex = new RegExp( rule[0] + '$' );

				// Last item in the rules.
				// It can also be a function, because the replace
				// method can have a function as the second argument.
				replacement = rule.slice( -1 )[0];

				// Input string match test
				if ( regex.test( input ) ) {
					// Context test required?
					if ( rule.length === 3 ) {
						if ( new RegExp( rule[1] + '$' ).test( context ) ) {
							return input.replace( regex, replacement );
						}
					} else {
						// No context test required. Just replace.
						return input.replace( regex, replacement );
					}
				}
			}

			// No matches, return the input
			return input;
		},

		keypress: function ( e ) {
			var altGr = false,
				c, startPos, pos, endPos, divergingPos, input, replacement;

			if ( !this.active ) {
				return true;
			}

			if ( !this.inputmethod ) {
				return true;
			}

			// handle backspace
			if ( e.which === 8 ) {
				// Blank the context
				this.context = '';
				return true;
			}

			if ( e.altKey || e.altGraphKey ) {
				altGr = true;
			}

			// Don't process ASCII control characters (except linefeed),
			// as well as anything involving
			// Alt (except for extended keymaps), Ctrl and Meta
			if ( ( e.which < 32 && e.which !== 13 && !altGr ) || e.ctrlKey || e.metaKey ) {
				// Blank the context
				this.context = '';

				return true;
			}

			c = String.fromCharCode( e.which );

			// Get the current caret position. The user may have selected text to overwrite,
			// so get both the start and end position of the selection. If there is no selection,
			// startPos and endPos will be equal.
			pos = this.getCaretPosition( this.$element );
			startPos = pos[0];
			endPos = pos[1];

			// Get the last few characters before the one the user just typed,
			// to provide context for the transliteration regexes.
			// We need to append c because it hasn't been added to $this.val() yet
			input = this.lastNChars( this.$element.val() || this.$element.text(), startPos,
					this.inputmethod.maxKeyLength )
					+ c;

			replacement = this.transliterate( input, this.context, altGr );

			// Update the context
			this.context += c;

			if ( this.context.length > this.inputmethod.contextLength ) {
				// The buffer is longer than needed, truncate it at the front
				this.context = this.context.substring( this.context.length
						- this.inputmethod.contextLength );
			}

			// it is a noop
			if ( replacement === input ) {
				return true;
			}

			// Drop a common prefix, if any
			divergingPos = this.firstDivergence( input, replacement );
			input = input.substring( divergingPos );
			replacement = replacement.substring( divergingPos );
			replaceText( this.$element, replacement, startPos - input.length + 1, endPos );

			e.stopPropagation();
			return false;
		},

		isActive: function () {
			return this.active;
		},

		disable: function () {
			this.active = false;
			$.ime.preferences.setIM( 'system' );
		},

		enable: function () {
			this.active = true;
		},

		toggle: function () {
			this.active = !this.active;
		},

		getIM: function () {
			return this.inputmethod;
		},

		setIM: function ( inputmethodId ) {
			this.inputmethod = $.ime.inputmethods[inputmethodId];
			$.ime.preferences.setIM( inputmethodId );
			//save the layout value (name) in browser cookie (setCookie function is located in functions.js)
				if (this.language=="bn") {
					//set Cookie
					setCookie("layout",inputmethodId,365);
				}
		},

		setLanguage: function ( languageCode ) {
			if ( $.inArray( languageCode, this.options.languages ) === -1 ) {
				//debug( 'Language ' + languageCode + ' is not known to jquery.ime.' );
				return false;
			}

			this.language = languageCode;
			$.ime.preferences.setLanguage( languageCode );
			return true;
		},

		getLanguage: function () {
			return this.language;
		},

		load: function ( name, callback ) {
			var ime = this,
				dependency;

			if ( $.ime.inputmethods[name] ) {
				if ( callback ) {
					callback.call( ime );
				}



			}

			dependency = $.ime.sources[name].depends;
			if ( dependency ) {
				this.load( dependency ) ;
			}

			$.ajax( {
				url: ime.options.imePath + $.ime.sources[name].source,
				dataType: 'script'
			} ).done( function () {
				//debug( name + ' loaded' );

				if ( callback ) {
					callback.call( ime );
				}
				//save the layout value (name) in browser cookie (setCookie function is located in functions.js)
				//setCookie("layout",name,365);
			} ).fail( function ( jqxhr, settings, exception ) {
				//debug( 'Error in loading inputmethod ' + name + ' Exception: ' + exception );
			} );
		},

		// Returns an array [start, end] of the beginning
		// and the end of the current selection in $element
		getCaretPosition: function ( $element ) {
			return getCaretPosition( $element );
		},

		/**
		 * Find the point at which a and b diverge, i.e. the first position
		 * at which they don't have matching characters.
		 *
		 * @param a String
		 * @param b String
		 * @return Position at which a and b diverge, or -1 if a === b
		 */
		firstDivergence: function ( a, b ) {
			return firstDivergence( a, b );
		},

		/**
		 * Get the n characters in str that immediately precede pos
		 * Example: lastNChars( 'foobarbaz', 5, 2 ) === 'ba'
		 *
		 * @param str String to search in
		 * @param pos Position in str
		 * @param n Number of characters to go back from pos
		 * @return Substring of str, at most n characters long, immediately preceding pos
		 */
		lastNChars: function ( str, pos, n ) {
			return lastNChars( str, pos, n );
		}
	};

	$.fn.ime = function ( option ) {
		return this.each( function () {
			var data,
				$this = $( this ),
				options = typeof option === 'object' && option;

			// Some exclusions: IME shouldn't be applied to textareas with
			// these properties.
			if ( $this.prop( 'readonly' ) ||
				$this.prop( 'disabled' ) ||
				$this.hasClass( 'noime' ) ) {
				return;
			}

			data = $this.data( 'ime' );

			if ( !data ) {
				data = new IME( this, options );
				$this.data( 'ime', data );
			}

			if ( typeof option === 'string' ) {
				data[option]();
			}
		} );
	};

	$.ime = {};
	$.ime.inputmethods = {};
	$.ime.sources = {};
	$.ime.preferences = {};
	$.ime.languages = {};

	var defaultInputMethod = {
		contextLength: 0,
		maxKeyLength: 1
	};

	$.ime.register = function ( inputMethod ) {
		$.ime.inputmethods[inputMethod.id] = $.extend( {}, defaultInputMethod, inputMethod );
	};

	// default options
	$.ime.defaults = {
		imePath: '', // Relative/Absolute path for the rules folder of jquery.ime
		languages: [] // Languages to be used- by default all languages
	};

	// private function for debugging
	function debug( $obj ) {
		if ( window.console && window.console.log ) {
			//window.console.log( $obj );
		}
	}

	// Returns an array [start, end] of the beginning
	// and the end of the current selection in $element
	function getCaretPosition( $element ) {
		var el = $element.get( 0 ),
			start = 0,
			end = 0,
			normalizedValue,
			range,
			textInputRange,
			len,
			endRange;

		if ( typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number' ) {
			start = el.selectionStart;
			end = el.selectionEnd;
		} else {
			// IE
			range = document.selection.createRange();

			if ( range && range.parentElement() === el ) {
				len = el.value.length;
				normalizedValue = el.value.replace( /\r\n/g, '\n' );

				// Create a working TextRange that lives only in the input
				textInputRange = el.createTextRange();
				textInputRange.moveToBookmark( range.getBookmark() );

				// Check if the start and end of the selection are at the very end
				// of the input, since moveStart/moveEnd doesn't return what we want
				// in those cases
				endRange = el.createTextRange();
				endRange.collapse( false );

				if ( textInputRange.compareEndPoints( 'StartToEnd', endRange ) > -1 ) {
					start = end = len;
				} else {
					start = -textInputRange.moveStart( 'character', -len );
					start += normalizedValue.slice( 0, start ).split( '\n' ).length - 1;

					if ( textInputRange.compareEndPoints( 'EndToEnd', endRange ) > -1 ) {
						end = len;
					} else {
						end = -textInputRange.moveEnd( 'character', -len );
						end += normalizedValue.slice( 0, end ).split( '\n' ).length - 1;
					}
				}
			}
		}

		return [ start, end ];
	}

	/**
	 * Helper function to get an IE TextRange object for an element
	 */
	function rangeForElementIE( e ) {
		if ( e.nodeName.toLowerCase() === 'input' ) {
			return e.createTextRange();
		} else {
			var sel = document.body.createTextRange();

			sel.moveToElementText( e );
			return sel;
		}
	}

	function replaceText( $element, replacement, start, end ) {
		var element = $element.get( 0 ),
			selection,
			length,
			newLines,
			scrollTop;

		if ( document.body.createTextRange ) {
			// IE
			selection = rangeForElementIE(element);
			length = element.value.length;
			// IE doesn't count \n when computing the offset, so we won't either
			newLines = element.value.match( /\n/g );

			if ( newLines ) {
				length = length - newLines.length;
			}

			selection.moveStart( 'character', start );
			selection.moveEnd( 'character', end - length );

			selection.text = replacement;
			selection.collapse( false );
			selection.select();
		} else {
			// All other browsers
			scrollTop = element.scrollTop;

			// This could be made better if range selection worked on browsers.
			// But for complex scripts, browsers place cursor in unexpected places
			// and it's not possible to fix cursor programmatically.
			// Ref Bug https://bugs.webkit.org/show_bug.cgi?id=66630
			element.value = element.value.substring( 0, start ) + replacement
					+ element.value.substring( end, element.value.length );
			// restore scroll
			element.scrollTop = scrollTop;
			// set selection
			element.selectionStart = element.selectionEnd = start + replacement.length;
		}
	}

	/**
	 * Find the point at which a and b diverge, i.e. the first position
	 * at which they don't have matching characters.
	 *
	 * @param a String
	 * @param b String
	 * @return Position at which a and b diverge, or -1 if a === b
	 */
	function firstDivergence( a, b ) {
		var minLength, i;

		minLength = a.length < b.length ? a.length : b.length;

		for ( i = 0; i < minLength; i++ ) {
			if ( a.charCodeAt( i ) !== b.charCodeAt( i ) ) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Get the n characters in str that immediately precede pos
	 * Example: lastNChars( 'foobarbaz', 5, 2 ) === 'ba'
	 *
	 * @param str String to search in
	 * @param pos Position in str
	 * @param n Number of characters to go back from pos
	 * @return Substring of str, at most n characters long, immediately preceding pos
	 */
	function lastNChars( str, pos, n ) {
		if ( n === 0 ) {
			return '';
		} else if ( pos <= n ) {
			return str.substr( 0, pos );
		} else {
			return str.substr( pos - n, n );
		}
	}

	function arrayKeys ( obj ) {
		var rv = [];
		$.each( obj, function ( key ) {
			rv.push( key );
		} );
		return rv;
	}
}( jQuery ) );
/*================
Jquery ime js stop
=================*/

( function ( $ ) {


	function IMESelector ( element, options ) {
		this.$element = $( element );
		this.options = $.extend( {}, IMESelector.defaults, options );
		this.active = false;
		this.$imeSetting = null;
		this.$menu = null;
		this.inputmethod = null;
		this.init();
		this.listen();
		this.timer = null;
	}

	IMESelector.prototype = {
		constructor: IMESelector,

		init: function () {
			this.prepareSelectorMenu();
			this.position();
			this.$imeSetting.hide();
		},

		prepareSelectorMenu: function () {

			// TODO: In this approach there is a menu for each editable area.
			// With correct event mapping we can probably reduce it to one menu.
			this.$imeSetting = $( selectorTemplate );
			this.$menu = $( '<div class="imeselector-menu" role="menu">' );
			this.$menu.append( imeListTitle() )
				.append( imeList() )
				.append( toggleMenuItem() )
				.append( languageListTitle() );
			this.prepareLanguageList();

			if ( $.i18n ) {
				this.$menu.i18n();
			}
			this.$imeSetting.append( this.$menu );
			$( 'body' ).append( this.$imeSetting );
		},

		stopTimer: function () {
			if ( this.timer ) {
				clearTimeout( this.timer );
				this.timer = null;
			}

			this.$imeSetting.stop( true, true );
		},

		resetTimer: function () {
			var imeselector = this;

			this.stopTimer();

			this.timer = setTimeout(
				function () {
					imeselector.$imeSetting.animate( {
						'opacity': 0,
						'marginTop': '-20px'
					}, 500, function () {
						imeselector.$imeSetting.hide();
						// Restore properties for next time it becomes visible:
						imeselector.$imeSetting.css( 'opacity', 1 );
						imeselector.$imeSetting.css( 'margin-top', 0 );
					} );
				}, 2500 );
		},

		focus: function () {
			// Hide all other IME settings
			$( 'div.imeselector' ).hide();
			this.$imeSetting.show();
			this.resetTimer();
		},

		show: function () {
			this.$menu.addClass( 'open' );
			this.stopTimer();
			this.$imeSetting.show();
			return false;
		},

		hide: function () {
			this.$menu.removeClass( 'open' );
			this.resetTimer();
			return false;
		},

		/**
		 * Bind the events and listen
		 */
		listen: function () {
			var imeselector = this;

			$( 'html' ).on( 'click.ime', function () {
				imeselector.hide();
				if ( imeselector.$element.is( ':hidden' ) ) {
					imeselector.$imeSetting.hide();
				}
			} );

			imeselector.$element.on( 'blur.ime', function () {
				if ( !imeselector.$imeSetting.hasClass( 'onfocus' ) ) {
					imeselector.$imeSetting.hide();
					imeselector.hide();
				}
			} );

			imeselector.$imeSetting.mouseenter( function () {
				imeselector.$imeSetting.addClass( 'onfocus' );
			} ).mouseleave( function () {
				imeselector.$imeSetting.removeClass( 'onfocus' );
			} );

			imeselector.$menu.on( 'click.ime', 'li', function() {
				imeselector.$element.focus();
			});

			imeselector.$menu.on( 'click.ime', 'li.ime-im', function ( e ) {
				imeselector.selectIM( $( this ).data( 'ime-inputmethod' ) );
				e.stopPropagation();
			} );

			imeselector.$menu.on( 'click.ime', 'li.ime-lang', function ( e ) {
				imeselector.selectLanguage( $( this ).attr( 'lang' ) );
				e.stopPropagation();
				e.preventDefault();
			} );

			imeselector.$menu.on( 'click.ime', 'div.ime-disable', function ( e ) {
				imeselector.disableIM();
				e.stopPropagation();
				e.preventDefault();
			} );

			imeselector.$imeSetting.on( 'click.ime', $.proxy( this.show, this ) );

			imeselector.$element.on( 'focus.ime', function ( e ) {
				imeselector.selectLanguage( $.ime.preferences.getLanguage() );
				imeselector.focus();
				e.stopPropagation();
			} );

			imeselector.$element.attrchange( function ( attrName ) {
				if( imeselector.$element.is( ':hidden') ) {
					imeselector.$imeSetting.hide();
				}
			} );

			// Possible resize of textarea
			imeselector.$element.on( 'mouseup.ime', $.proxy( this.position, this ) );
			imeselector.$element.on( 'keydown.ime', $.proxy( this.keydown, this ) );
		},

		/**
		 * Keydown event handler. Handles shortcut key presses
		 *
		 * @context {HTMLElement}
		 * @param {jQuery.Event} e
		 */
		keydown: function ( e ) {
			var ime = $( e.target ).data( 'ime' );
			this.focus(); // shows the trigger in case it is hidden
			if ( isShortcutKey( e ) ) {
				if ( ime.isActive() ) {
					this.disableIM();
				} else {
					if ( this.inputmethod !== null ) {
						this.selectIM( this.inputmethod.id );
					} else {
						this.selectLanguage( $.ime.preferences.getLanguage() );
					}
				}

				e.preventDefault();
				e.stopPropagation();

				return false;
			}

			return true;
		},

		/**
		 * Position the im selector relative to the edit area
		 */
		position: function () {
			this.focus();  // shows the trigger in case it is hidden
			var imeSelector = this,
				position, top, left, room;

			position = this.$element.offset();
			top = position.top + this.$element.outerHeight();
			left = position.left + this.$element.outerWidth()
				- this.$imeSetting.outerWidth();
			room = $( window ).height() - top;
			if ( room < this.$imeSetting.outerHeight() ) {
				top = top - this.$imeSetting.outerHeight();

				this.$menu.css( 'top',
								- ( this.$menu.outerHeight() +
									this.$imeSetting.outerHeight()
								  ) )
					.addClass( 'position-top' );
			}

			this.$element.parents().each( function() {
				if ( $( this ).css( 'position' ) === 'fixed' ) {
					imeSelector.$imeSetting.css( 'position', 'fixed' );
					return false;
				}
			} );

			this.$imeSetting.css({
				top: top,
				left: left
			});
		},

		/**
		 * Select a language
		 *
		 * @param languageCode
		 */
		selectLanguage: function ( languageCode ) {
			var language, ime;

			ime = this.$element.data( 'ime' );
			language = $.ime.languages[languageCode];

			if ( !language ) {
				return false;
			}

			if ( ime.getLanguage() === languageCode ) {
				// nothing to do. It is same as the current language
				return false;
			}

			this.$menu.find( 'li.ime-lang' ).show();
			this.$menu.find( 'li[lang=' + languageCode + ']' ).hide();

			this.$menu.find( '.ime-list-title' ).text( language.autonym );
			this.prepareInputMethods( languageCode );
			this.hide();
			// And select the default inputmethod
			ime.setLanguage( languageCode );
			this.inputmethod = null;
			this.selectIM( $.ime.preferences.getIM( languageCode ) );
		},

		/**
		 * Select an input method
		 *
		 * @param inputmethodId
		 */
		selectIM: function ( inputmethodId ) {
			var imeselector = this,
				ime;

			this.$menu.find( '.checked' ).removeClass( 'checked' );
			this.$menu.find( 'li.ime-disable' ).removeClass( 'checked' );
			this.$menu.find( 'li[data-ime-inputmethod=' + inputmethodId + ']' )
				.addClass( 'checked' );
			ime = this.$element.data( 'ime' );

			if ( inputmethodId === 'system' ) {
				this.disableIM();
				return;
			}

			if ( !inputmethodId ) {
				return;
			}

			ime.load( inputmethodId, function () {
				var name;

				imeselector.inputmethod = $.ime.inputmethods[inputmethodId];
				imeselector.hide();
				ime.enable();
				name = imeselector.inputmethod.name;
				ime.setIM( inputmethodId );
				imeselector.$imeSetting.find( 'a.ime-name' ).text( name );

				imeselector.position();

				// save this preference
				$.ime.preferences.save();
			} );
		},

		/**
		 * Disable the inputmethods (Use the system input method)
		 */
		disableIM: function () {
			this.$menu.find( '.checked' ).removeClass( 'checked' );
			this.$menu.find( 'div.ime-disable' ).addClass( 'checked' );
			this.$element.data( 'ime' ).disable();
			this.$imeSetting.find( 'a.ime-name' ).text( '' );
			this.hide();
			this.position();

			// save this preference
			$.ime.preferences.save();
		},

		/**
		 * Prepare language list
		 */
		prepareLanguageList: function () {
			var languageCodeIndex = 0,
				$languageListWrapper,
				$languageList,
				languageList,
				$languageItem,
				$language,
				languageCode,
				language;

			// Language list can be very long. So we use a container with
			// overflow auto.
			$languageListWrapper = $( '<div class="ime-language-list-wrapper">' );
			$languageList = $( '<ul class="ime-language-list">' );

			if ( $.isFunction( this.options.languages ) ) {
				languageList = this.options.languages();
			} else {
				languageList = this.options.languages;
			}

			for ( languageCodeIndex in languageList ) {
				languageCode = languageList[languageCodeIndex];
				language = $.ime.languages[languageCode];

				if ( !language ) {
					continue;
				}

				$languageItem = $( '<a>' ).attr( 'href', '#' ).text( language.autonym );
				$language = $( '<li class="ime-lang">' ).attr( 'lang', languageCode );
				$language.append( $languageItem );
				$languageList.append( $language );
			}

			$languageListWrapper.append( $languageList );
			this.$menu.append( $languageListWrapper );

			if ( this.options.languageSelector ) {
				this.$menu.append( this.options.languageSelector() );
			}
		},

		/**
		 * Prepare input methods in menu for the given language code
		 *
		 * @param languageCode
		 */
		prepareInputMethods: function ( languageCode ) {
			var language = $.ime.languages[languageCode],
				$imeList = this.$menu.find( '.ime-list' );

			$imeList.empty();

			$.each( language.inputmethods, function ( index, inputmethod ) {
				var name = $.ime.sources[inputmethod].name,
					$imeItem = $( '<a>' ).text( name ),
					$inputMethod = $( '<li data-ime-inputmethod=' + inputmethod + '>' );

				$inputMethod.append( '<span class="ime-im-check">' ).append( $imeItem );
				$inputMethod.addClass( 'ime-im' );
				$imeList.append( $inputMethod );
			} );
		},


	};

	IMESelector.defaults = {
		defaultLanguage: 'en'
	};

	/*
	 * imeselector PLUGIN DEFINITION
	 */

	$.fn.imeselector = function ( options ) {
		return this.each( function () {
			var $this = $( this ),
				data = $this.data( 'imeselector' );
			if ( !data ) {
				$this.data( 'imeselector', ( data = new IMESelector( this, options ) ) );
			}

			if ( typeof options === 'string' ) {
				data[options].call( $this );
			}
		} );
	};

	$.fn.imeselector.Constructor = IMESelector;

	function languageListTitle () {
		return $( '<h3>' )
			.addClass( 'ime-lang-title' )
			.attr( 'data-i18n', 'jquery-ime-other-languages' )
			.text( 'Other languages' );
	}

	function imeList () {
		return  $( '<ul>' ).addClass( 'ime-list' );
	}

	function imeListTitle () {
		return  $( '<h3>' ).addClass( 'ime-list-title' );
	}

	function toggleMenuItem () {
		return $( '<div class="ime-disable">' )
			.append( $( '<span>' )
				.attr( {
					'class': 'ime-disable-link',
					'data-i18n': 'jquery-ime-disable-text'
				} )
				.text( 'System input method' )
			).append( $( '<span>' )
				.addClass( 'ime-disable-shortcut' )
				.text( 'CTRL+M' )
			);
	}

	var selectorTemplate = '<div class="imeselector">'
		+ '<a class="ime-name imeselector-toggle" href="#"></a>'
		+ '<b class="ime-setting-caret"></b></div>';

	/**
	 * Check whether a keypress event corresponds to the shortcut key
	 *
	 * @param event Event object
	 * @return bool
	 */
	function isShortcutKey ( event ) {
		// 77 - The letter M, for Ctrl-M
		// 13 - The Enter key
		return event.ctrlKey && ( event.which === 77 || event.which === 13 );
	}

	var MutationObserver = window.MutationObserver || window.WebKitMutationObserver
		|| window.MozMutationObserver;

	function isDOMAttrModifiedSupported () {
		var p = document.createElement( 'p' ),
			flag = false;

		if ( p.addEventListener ) {
			p.addEventListener( 'DOMAttrModified', function () {
				flag = true;
			}, false );
		} else if ( p.attachEvent ) {
			p.attachEvent( 'onDOMAttrModified', function () {
				flag = true;
			} );
		} else {
			return false;
		}

		p.setAttribute( 'id', 'target' );

		return flag;
	}

	$.fn.attrchange = function ( callback ) {
		if ( MutationObserver ) {
			var observer,
				options = {
				subtree: false,
				attributes: true
			};

			observer = new MutationObserver( function ( mutations ) {
				mutations.forEach( function ( e ) {
					callback.call( e.target, e.attributeName );
				} );
			} );

			return this.each( function () {
				observer.observe( this, options );
			} );

		} else if ( isDOMAttrModifiedSupported() ) {
			return this.on( 'DOMAttrModified', function ( e ) {
				callback.call( this, e.attrName );
			} );
		} else if ( 'onpropertychange' in document.body ) {
			return this.on( 'propertychange', function () {
				callback.call( this, window.event.propertyName );
			} );
		}
	};


}( jQuery ) );

/*====================
=====================*/

( function ( $ ) {
	'use strict';

	$.extend( $.ime.preferences, {
		registry: {
			isDirty: false,
			language : 'en',
			previousLanguages: [], // array of previous languages
			imes: {
				'en': 'system'
			}
		},

		setLanguage: function ( language ) {
			// Do nothing if there's no actual change
			if ( language === this.registry.language ) {
				return;
			}

			this.registry.language = language;
			this.registry.isDirty = true;
			if ( !this.registry.previousLanguages ) {
				this.registry.previousLanguages = [];
			}

			// Add to the previous languages, but avoid duplicates.
			if ( $.inArray( language, this.registry.previousLanguages ) === -1 ) {
				this.registry.previousLanguages.push( language );
			}
		},

		getLanguage: function () {
			return this.registry.language;
		},

		getPreviousLanguages: function () {
			return this.registry.previousLanguages;
		},

		// Set the given IM as the last used for the language
		setIM: function ( inputMethod ) {
			if ( !this.registry.imes ) {
				this.registry.imes = {};
			}

			// Do nothing if there's no actual change
			if ( inputMethod === this.registry.imes[this.registry.language] ) {
				return;
			}

			this.registry.imes[this.getLanguage()] = inputMethod;
			this.registry.isDirty = true;
		},

		// Return the last used or the default IM for language
		getIM: function ( language ) {
			if ( !this.registry.imes ) {
				this.registry.imes = {};
			}
			return this.registry.imes[language] || $.ime.languages[language].inputmethods[0];
		},

		save: function () {
			// save registry in cookies or localstorage
		},

		load: function () {
			// load registry from cookies or localstorage
		}
	} );
}( jQuery ) );
/*=============
==============*/
( function ( $ ) {
	'use strict';

	$.extend( $.ime.sources, {

		'bn-avro': {
			name: 'Avro',
			source: 'rules/bn/bn-avro.js'
		},
		'bn-inscript': {
			name: 'ইন্‌স্ক্ৰিপ্ত',
			source: 'rules/bn/bn-inscript.js'
		},
		'bn-nkb': {
			name: 'National Keyboard',
			source: 'rules/bn/bn-nkb.js'
		},
		'bn-probhat': {
			name: 'Probhat',
			source: 'rules/bn/bn-probhat.js'
		},
		'ipa-sil': {
			name: 'International Phonetic Alphabet - SIL',
			source: 'rules/fonipa/ipa-sil.js'
		}
	} );

	$.extend( $.ime.languages, {

		'bn': {
			autonym: 'বাংলা',
			inputmethods: [ 'bn-avro', 'bn-inscript', 'bn-nkb', 'bn-probhat' ]
		},
		'en': {
			autonym: 'English',
			inputmethods: [ 'ipa-sil' ]
		}
	} );

}( jQuery ) );

/*==========================
============================*/

( function ( $ ) {
	'use strict';

	$.extend( $.ime.sources, {

		'bn-avro': {
			name: 'Avro',
			source: 'rules/bn/bn-avro.js'
		},
		'bn-inscript': {
			name: 'ইন্‌স্ক্ৰিপ্ত',
			source: 'rules/bn/bn-inscript.js'
		},
		'bn-nkb': {
			name: 'National Keyboard',
			source: 'rules/bn/bn-nkb.js'
		},
		'bn-probhat': {
			name: 'Probhat',
			source: 'rules/bn/bn-probhat.js'
		},
		'ipa-sil': {
			name: 'International Phonetic Alphabet - SIL',
			source: 'rules/fonipa/ipa-sil.js'
		}
	} );

	$.extend( $.ime.languages, {

		'bn': {
			autonym: 'বাংলা',
			inputmethods: [ 'bn-avro', 'bn-inscript', 'bn-nkb', 'bn-probhat' ]
		},
		'en': {
			autonym: 'English',
			inputmethods: [ 'ipa-sil' ]
		}
	} );

}( jQuery ) );

/*==========================
============================*/

function searchValidate(value){
    if(value.trim()==''){
        return false
    }
    else{
        return true;
    }
}

function hide_n_slide(obj)
{
    $(obj).fadeTo(400, 0, function () { // Links with the class "close" will close parent
        $(obj).slideUp(400);
    //$(obj).stopTime("hide");
    });
}

function notification_animation(i, obj)
{
    $(obj).hide();
    $(obj).oneTime(i*2000, function() {
        $(obj).slideDown(200, function(){
            $(obj).fadeIn(400, function(){
                if(!$(obj).hasClass('static')){
                    $(obj).oneTime(20000, "hide", function(){
                        hide_n_slide(obj);
                    })
                }
            })
        })
    })
}

function create_notification(parent, type, msg, i)
{
    var span = document.createElement('span');
    $(span).hide();
    $('span').attr({class:'notifciation n-'+type}).text(msg);
    $(span).appendTo($(parent));
    notification_animation(i, $(span));
}

$(document).ready(function() {

    $( "#std_school, #std_name_bn, #searchbox, #home-searchbox,input,textarea,.UFIAddCommentInput" ).ime();
    $("#searchbox").focus();
    setTimeout( function() { $("input").focus(); }, 500);
		setTimeout( function() { $("textarea").focus(); }, 500);

    //$('a.cache').modalPanel();

    $('.notification').click(function(){
        hide_n_slide(this);
        return false;
    })

    /*var hidden_lang = $('#lang-switch > .hidden-lang');
    hidden_lang.hide();
    $('#lang-switch').mouseover(function(){
        hidden_lang.fadeIn();
    });
    $('#lang-switch').mouseleave(function(){
        hidden_lang.fadeOut();
    });
    */

});



//ajax
$.ajaxSetup({
    beforeSend: function() {
        $('#ajax-loader').fadeIn(500);
    },
    complete: function(){
        $('#ajax-loader').fadeOut(500);
    },
    success: function() {
        $('#ajax-loader').fadeOut(500);
    }
});


//Hide and Show dateTools
var i;
function dateTools () {

    if (i==null) {
        $("#dateTools").show(400);
        i=1;
        setTimeout(
            function()
            {
                $( "#dateTools" ).addClass('dateTools');
            }, 600);

        return;
    };//alert('Date Tolls');
    $( "#dateTools" ).removeClass('dateTools');
    $("#dateTools").hide(400);
    i=null;
    return;
}



$(document).ready(function(){
    setTimeout(
        function()
        {
            $( "a.cache" ).show(700);
        }, 1000);
    setTimeout(
        function()
        {
            $( "#SeachTime" ).show(700);
        }, 1000);
    setTimeout(
        function()
        {
            $( "#DateSearchButton" ).show(800);
        }, 2000);

});

function showDetails( docId, languageId, showtype ){
    //alert(docId+":"+languageId);
    var url =base_url+"site_ajax_calls/show_details/"+docId+"/"+languageId+"/"+showtype;
    var modal = document.getElementById('myModal'+docId);
    //alert(modal);
    // if(modal!=null) {
    //     $("#myModal").remove();
    // }
    $(modal).modal({
         remote: url
});

}

function setCookie(c_name,value,exdays){
  var exdate=new Date();
  exdate.setDate(exdate.getDate() + exdays);
  var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
  document.cookie=c_name + "=" + c_value;
}

/*===============================
==============================*/

( function ( $ ) {
	'use strict';

	var bnAvro = {
		id: 'bn-avro',
		name: 'অভ্র',
		description: 'Bengali Avro input method',
		date: '2012-10-10',
		URL: 'http://github.com/wikimedia/jquery.ime',
		author: 'Junaid P V',
		license: 'GPLv3',
		version: '1.0',
		contextLength: 4,
		maxKeyLength: 5,
		patterns: [
			['([ক-হড়ঢ়য়])্?ররi','[^o`]', '$1ৃ'],
			['ররi','[^o`]', 'ঋ'],
			['ঙহo', 'ঙ্ঘ'],
			['([ক-হড়ঢ়য়])াZ', '[^o`]', '$1্যা'],
			['(([ক-হড়ঢ়য়])|য়)o','[^o`]', '$1'], // য় cannot be included in the range, why? everywhere else it is OK!
			['([ক-হড়ঢ়য়])a','[^o`]', '$1া'],
			['([ক-হড়ঢ়য়])i','[^o`]', '$1ি'],
			['([ক-হড়ঢ়য়])(I|েe)','[^o`]', '$1ী'],
			['([ক-হড়ঢ়য়])u','[^o`]', '$1ু'],
			['([ক-হড়ঢ়য়])U','[^o`]', '$1ূ'],
			['([ক-হড়ঢ়য়])o','[o`]', '$1ু'],
			['([ক-হড়ঢ়য়])e','[^o`]', '$1ে'],
			['([ক-হড়ঢ়য়])োI','[^o`]', '$1ৈ'],
			['([ক-হড়ঢ়য়])O','[^o`]', '$1ো'],
			['([ক-হড়ঢ়য়])োU','[^o`]', '$1ৌ'],

			['([ক-হড়ঢ়য়][িুেো]|[এইওউ])a','[^o`]', '$1য়া'],
			['([ক-হড়ঢ়য়][াে]|[আএ])o', '[^o`]', '$1ও'],

			['([কঙলষস])(k|K)','[^o`]','$1্ক'],
			['([ঙদল])(g|G)','[^o`]','$1্গ'],
			['গg','[^o`]','জ্ঞ'],
			['([চশ])c','[^o`]','$1্চ'],
			['([জঞব])j','[^o`]','$1্জ'],
			['নj','[^o`]','ঞ্জ'],
			['([কটণনপলষস])T','[^o`]','$1্ট'],
			['([ডণনল])D','[^o`]','$1্ড'],
			['([গষহ])N','[^o`]','$1্ণ'],
			['([কতনপশসহ])t','[^o`]','$1্ত'],
			['([দনব])d','[^o`]','$1্দ'],
			['([গঘণতধনপমশসহ])n','[^o`]','$1্ন'],
			['([পমলষস])p','[^o`]','$1্প'],
			['([স])f', '[^o`]', '$1্ফ'],
			['([বমল])b','[^o`]','$1্ব'],
			['([দম])(v|V)','[^o`]','$1্ভ'],
			['([কগঙটণতদধনমলশষসহ])m','[^o`]','$1্ম'],
			['([ক-ঘচ-ঝট-যলশ-হড়ঢ়য়])r','[^o`]','$1্র'],
			['([কগপ-বমলশসহ])l','[^o`]','$1্ল'],
			['([কনপ])s','[^o`]','$1্স'],
			['([ক-হড়ঢ়য়])w','[^o`]','$1্ব'],
			['([ক-যল-হড়ঢ়য়])y','[^o`]','$1্য'],
			['নc','[^o`]','ঞ্চ'],

			['ত`','`' ,'ৎ'],

			['ক্ক(h|H)','[^o`]','ক্ষ'],
			['কশ(h|H)','[^o`]','ক্ষ'],

			['ররk','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ক'],
			['ররg','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্গ'],
			['ররc','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্চ'],
			['ররj','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্জ'],
			['ররT','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ট'],
			['ররD','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ড'],
			['ররN','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ণ'],
			['ররt','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ত'],
			['ররd','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্দ'],
			['ররn','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ন'],
			['ররp','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্প'],
			['ররf','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ফ'],
			['ররb','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ব'],
			['ররv','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ভ'],
			['ররm','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ম'],
			['ররz','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্য'],
			['ররl','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ল'],
			['ররS','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্শ'],
			['ররs','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্স'],
			['ররh','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্হ'],
			['ররR','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্ড়'],
			['রর(y|Y)','(o|a|i|I|u|U|e|O|OI|OU|rri)rr','র্য়'],


			['র(y|Z)', 'র‍্য'],
			['ংo', 'ঙ্গ'],
			['ংi', 'ঙ্গি'],
			['ংI', 'ঙ্গী'],
			['(ংu|ঙ্গo)', 'ঙ্গু'],
			['ংU', 'ঙ্গূ'],
			['ং', 'ঙ্গি'],
			['ং', 'ঙ্গি'],

			['শ(h|H)','S', 'ষ'],

			['অo','[^`]', 'উ'],
			['এe','[^o`]', 'ঈ'],

			['ক(h|H)','[^o`]', 'খ'],
			['গ(h|H)','[^o`]', 'ঘ'],
			['ণg','[^o`]', 'ঙ'],
			['চ(h|H)','[^o`]', 'ছ'],
			['জ(h|H)','[^o`]', 'ঝ'],
			['ণG','[^o`]', 'ঞ'],
			['ট(h|H)','[^o`]', 'ঠ'],
			['ড(h|H)','[^o`]', 'ঢ'],
			['ত(h|H)','[^o`]', 'থ'],
			['দ(h|H)','[^o`]', 'ধ'],
			['প(h|H)','[^o`]', 'ফ'],
			['ব(h|H)','[^o`]', 'ভ'],
			['(স(h|H))','[^o`]', 'শ'],
			['ড়(h|H)','[^o`]', 'ঢ়'],
			['ত্`','[^o`]', 'ৎ'],
			['নg','[^o`]', 'ং'],
			['ঃ`','[^o`]', ':'],
			['ররi','[^o`]', 'ঋ'],
			['ওI','[^o`]', 'ঐ'],
			['ওU','[^o`]', 'ঔ'],

			['আ`', 'া'],
			['ই`', 'ি'],
			['ঈ`', 'ী'],
			['উ`', 'ু'],
			['ঊ`', 'ূ'],
			['এ`', 'ে'],
			['আ`', 'া'],
			['আ`', 'া'],
			['আ`', 'া'],
			['আ`', 'া'],
			['আ`', 'া'],
			['আ`', 'া'],

			['([kKqQ])', 'ক'],
			['(g|G)', 'গ'],
			['(c|C)', 'চ'],
			['(j|J)', 'জ'],
			['T', 'ট'],
			['D', 'ড'],
			['N', 'ণ'],
			['t', 'ত'],
			['d', 'দ'],
			['n', 'ন'],
			['(p|P)', 'প'],
			['f', 'ফ'],
			['(b|B)', 'ব'],
			['(v|V)', 'ভ'],
			['(m|M)', 'ম'],
			['z', 'য'],
			['r', 'র'],
			['(l|L)', 'ল'],
			['S', 'শ'],
			['s', 'স'],
			['(h|H)', 'হ'],
			['R', 'ড়'],
			['w', 'ও'],
			['x', 'ক্স'],
			['(y|Y)', 'য়'],

			['Z', '্য'],

			['o', 'অ'],
			['(a|A)', 'আ'],
			['i', 'ই'],
			['I', 'ঈ'],
			['u', 'উ'],
			['U', 'ঊ'],
			['(e|E)', 'এ'],
			['O', 'ও'],

			['0', '০'],
			['1', '১'],
			['2', '২'],
			['3', '৩'],
			['4', '৪'],
			['5', '৫'],
			['6', '৬'],
			['7', '৭'],
			['8', '৮'],
			['9', '৯'],

			['\\\\\\.', '.'],

			[',,', '্'],
			['\\:', 'ঃ'],
			['\\^', 'ঁ'],
			['\\.', '।'],
			['\\$', '৳'],
			['ঃ`', ':'],
			['`', '']]
	};
	$.ime.register( bnAvro );

}( jQuery ) );
