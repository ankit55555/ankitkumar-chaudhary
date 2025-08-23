// JS for Featured Six Products section
// Reserved for future interactive behaviors
document.addEventListener('DOMContentLoaded', function () {
	function openModal(id) {
		var modal = document.getElementById(id);
		if (!modal) return;
		modal.removeAttribute('hidden');
		const closeOnEsc = function (evt) {
			if (evt.key === 'Escape') closeModal(modal);
		};
		modal._esc = closeOnEsc;
		document.addEventListener('keydown', closeOnEsc);
	}

	function refreshCartUI(openAfter) {
		var root = (window.Shopify && Shopify.routes && Shopify.routes.root) ? Shopify.routes.root : '/';
		var sections = ['cart-drawer','cart-icon-bubble'];
		fetch(root + '?sections=' + sections.join(',')).then(function(r){ return r.json(); }).then(function(data){
			try {
				if (data['cart-icon-bubble']) {
					var bubble = document.getElementById('cart-icon-bubble');
					if (bubble) bubble.innerHTML = data['cart-icon-bubble'];
				}
				if (data['cart-drawer']) {
					var drawerEl = document.querySelector('cart-drawer');
					if (drawerEl) {
						drawerEl.outerHTML = data['cart-drawer'];
						drawerEl = document.querySelector('cart-drawer');
						if (openAfter && drawerEl) {
							if (typeof drawerEl.open === 'function') drawerEl.open();
							else drawerEl.setAttribute('open','');
						}
					}
				}
			} catch(e) {}
		}).catch(function(){
			// Fallback: update cart count from cart.js
			fetch(root + 'cart.js').then(function(r){ return r.json(); }).then(function(cart){
				var bubbleCount = document.querySelector('#cart-icon-bubble .cart-count-bubble, .cart-count-bubble');
				if (bubbleCount) {
					if (cart.item_count > 0) {
						bubbleCount.innerHTML = '<span aria-hidden="true">' + cart.item_count + '</span>';
						bubbleCount.style.display = '';
					} else {
						bubbleCount.style.display = 'none';
					}
				}
			});
		});
	}

	function closeModal(modal) {
		if (!modal) return;
		modal.setAttribute('hidden', 'hidden');
		if (modal._esc) {
			document.removeEventListener('keydown', modal._esc);
			delete modal._esc;
		}
	}

	// Open handlers
	document.querySelectorAll('[data-open-modal]').forEach(function (el) {
		el.addEventListener('click', function (e) {
			e.preventDefault();
			openModal(el.getAttribute('data-open-modal'));
		});
		el.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openModal(el.getAttribute('data-open-modal'));
			}
		});
	});

	// Close handlers (overlay and X)
	document.body.addEventListener('click', function (e) {
		var closeTrigger = e.target.closest('[data-close-modal]');
		if (closeTrigger) {
			var modal = closeTrigger.closest('.fsp-modal');
			closeModal(modal);
		}
	});

	// Initialize each product modal
	document.querySelectorAll('[data-product-modal]').forEach(function (modal) {
		var productJsonScript = modal.querySelector('[data-product-json]');
		if (!productJsonScript) return;
		var productData; try { productData = JSON.parse(productJsonScript.textContent); } catch (e) { productData = null; }
		if (!productData) return;

		var form = modal.querySelector('[data-product-form]');
		var priceEl = modal.querySelector('[data-price]');
		var idInput = modal.querySelector('[data-variant-id]');
		var optionInputs = modal.querySelectorAll('[data-option-position]');
		var atcBtn = form ? form.querySelector('.fsp-atc') : null;
		var minVariant = (productData.variants || [])[0];
		if (productData.variants && productData.variants.length > 1) {
			minVariant = productData.variants.slice().sort(function (a,b){return a.price-b.price;})[0];
		}

			function formatMoneyCents(cents) {
		if (window.Shopify && typeof Shopify.formatMoney === 'function') {
			var mf = (window.theme && window.theme.moneyWithCurrencyFormat) || (window.Shopify && window.Shopify.money_with_currency_format) || '${{amount}} {{currency}}';
			return Shopify.formatMoney(cents, mf);
		}
		return '$' + (cents / 100).toFixed(2) + ' CAD';
	}

		function getCurrentOptions() {
			var options = [];
			optionInputs.forEach(function (input) {
				var position = parseInt(input.getAttribute('data-option-position'), 10);
				var value;
				if (input.tagName === 'SELECT') value = input.value;
				else if (input.type === 'radio') {
					if (!input.checked) return;
					value = input.value;
				}
				options[position - 1] = value;
			});
			return options;
		}

		function findVariantByOptions(options) {
			return (productData.variants || []).find(function (v) {
				return v.options.every(function (opt, idx) { return opt === options[idx]; });
			});
		}

		function updateUIForVariant(variant) {
			if (!variant) {
				idInput.value = '';
				if (atcBtn) atcBtn.setAttribute('disabled', 'disabled');
				if (priceEl) priceEl.textContent = 'Unavailable';
				return;
			}
			idInput.value = variant.id;
			var money = formatMoneyCents(variant.price);
			if (priceEl) priceEl.textContent = money;
			if (variant.available && atcBtn) atcBtn.removeAttribute('disabled');
			else if (atcBtn) atcBtn.setAttribute('disabled', 'disabled');
		}

		function handleOptionChange() {
			// Toggle visual selection for swatches
			var input = this;
			if (input.type === 'radio') {
				var container = input.closest('.fsp-swatch-list');
				if (container) {
					container.querySelectorAll('.fsp-swatch').forEach(function (lbl) { lbl.classList.remove('is-selected'); });
					var label = input.closest('.fsp-swatch');
					if (label) label.classList.add('is-selected');
				}
			}
			var opts = getCurrentOptions();
			var hasMissing = opts.some(function(v){ return v == null || v === '' || typeof v === 'undefined'; });
			if (hasMissing) {
				if (priceEl && minVariant) priceEl.textContent = formatMoneyCents(minVariant.price);
				if (atcBtn) atcBtn.setAttribute('disabled', 'disabled');
				idInput.value = '';
				return;
			}
			var variant = findVariantByOptions(opts);
			updateUIForVariant(variant);
		}

		optionInputs.forEach(function (input) {
			input.addEventListener('change', handleOptionChange);
		});

		// Initialize first state
		handleOptionChange.call(optionInputs[0] || {});

		// AJAX Add to cart
		if (form) {
			form.addEventListener('submit', function (e) {
				e.preventDefault();
				var id = idInput?.value;
				if (!id) return;
				var btn = form.querySelector('.fsp-atc');
				var label = btn ? btn.querySelector('span') : null;
				var originalText = label ? label.textContent : (btn ? btn.textContent : '');
				if (btn) btn.setAttribute('disabled', 'disabled');
				if (label) label.textContent = 'ADDING…';
				fetch('/cart/add.js', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: id, quantity: 1 })
				}).then(function (r) { return r.json(); })
				.then(function () {
					if (label) label.textContent = 'ADDED TO CART';
					if (btn) btn.removeAttribute('disabled');
					setTimeout(function(){ if (label) label.textContent = originalText || 'ADD TO CART'; }, 1500);
					refreshCartUI(true);
				}).catch(function () {
					if (label) label.textContent = originalText || 'ADD TO CART';
					if (btn) btn.removeAttribute('disabled');
				});
			});
		}
	});
});


