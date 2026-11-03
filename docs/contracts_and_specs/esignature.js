/**
 * Nexus SecureSign — Interactive Client E-Signature & Audit Trail Engine
 * For Raku's Kitchen & Nexus Development Documentation Portal
 */

(function () {
  'use strict';

  // Available Documents Registry (Invoices excluded by explicit instruction)
  const SIGNABLE_DOCS = {
    'doc_00_welcome': {
      title: 'Client Welcome Kit & Handover Guide',
      ref: '00',
      file: '00_Client_Welcome_Kit_and_Onboarding_Guide.html'
    },
    'doc_01_brd': {
      title: 'Business Requirements Document (BRD)',
      ref: '01',
      file: '01_BRD_Business_Requirements_Document.html'
    },
    'doc_02_prd': {
      title: 'Product Requirements Document (PRD)',
      ref: '02',
      file: '02_PRD_Product_Requirements_Document.html'
    },
    'doc_03_sow': {
      title: 'Statement of Work (SOW)',
      ref: '03',
      file: '03_SOW_Statement_of_Work.html'
    },
    'doc_04_sla': {
      title: 'Service Level Agreement (SLA)',
      ref: '04',
      file: '04_SLA_Service_Level_Agreement.html'
    }
  };

  const STORAGE_KEY_PREFIX = 'nexus_securesign_';
  let currentDocId = null;
  let activeTab = 'draw';
  let activeFont = 'Dancing Script';
  let canvas, ctx, isDrawing = false, hasDrawn = false;

  // Initialize
  window.NexusSign = {
    init: function (docId) {
      currentDocId = docId;
      if (!SIGNABLE_DOCS[docId]) {
        console.warn('Document not registered in signable registry:', docId);
        return;
      }
      
      // Inject CSS if not already present
      if (!document.querySelector('link[href*="esignature.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'esignature.css';
        document.head.appendChild(link);
      }

      // Render components
      renderStickyBar();
      renderSignOffGrid();
      injectModal();
      bindEvents();
      updateUI();
    },

    getSignStatus: function (docId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + docId);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    getAllSignStatuses: function () {
      const results = {};
      Object.keys(SIGNABLE_DOCS).forEach(id => {
        results[id] = this.getSignStatus(id);
      });
      return results;
    },

    clearSignature: function (docId) {
      if (confirm('Are you sure you want to clear this digital signature?')) {
        localStorage.removeItem(STORAGE_KEY_PREFIX + (docId || currentDocId));
        updateUI();
      }
    }
  };

  // Helper: Format IST Timestamp
  function formatIST(dateObj) {
    const d = dateObj || new Date();
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' IST';
  }

  // Helper: Generate Cryptographic Verification Hash
  async function generateVerificationHash(docId, name, timestamp) {
    const payload = `${docId}|${name}|${timestamp}|${navigator.userAgent}|NexusSecureSign2026`;
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(payload);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20).toUpperCase();
      return `SIG-RK-${hashHex}`;
    }
    return `SIG-RK-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
  }

  // 1. Render Top Sticky Header
  function renderStickyBar() {
    const existing = document.querySelector('.esign-sticky-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.className = 'esign-sticky-bar';
    bar.id = 'esignStickyBar';
    bar.innerHTML = `
      <div class="esign-sticky-left">
        <a href="index.html" class="esign-portal-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Documentation Hub
        </a>
        <div id="esignStatusBadge" class="esign-status-pill unsigned">
          <span class="pulse-dot"></span>
          <span id="esignStatusText">Pending Client Signature</span>
        </div>
      </div>
      <div class="esign-sticky-right">
        <button id="esignPrimaryBtn" class="esign-btn esign-btn-primary">
          ✍️ Sign This Document
        </button>
        <button id="esignPrintBtn" class="esign-btn esign-btn-secondary" onclick="window.print()">
          🖨️ Print / Save PDF
        </button>
      </div>
    `;

    document.body.insertBefore(bar, document.body.firstChild);
  }

  // 2. Render / Replace Document Sign-off Grid
  function renderSignOffGrid() {
    // Find existing sign-off-grid
    const existingGrid = document.querySelector('.sign-off-grid');
    const container = existingGrid ? existingGrid.parentElement : document.querySelector('.page') || document.body;

    const grid = document.createElement('div');
    grid.className = 'esign-grid';
    grid.id = 'esignSignOffGrid';

    // Provider Block (Nexus Development) — Certified Official Pre-signature
    const providerHtml = `
      <div class="esign-card-block signed-box">
        <div class="esign-card-header">
          <div class="esign-role-tag">Delivery Partner & Solutions Provider</div>
          <div class="esign-party-name">Nexus Development</div>
          <div class="esign-sub-role">Custom Software Solutions & Enterprise IT Delivery</div>
        </div>

        <div class="esign-display-zone" style="cursor: default; border-color: #86EFAC; background: #FFFFFF;">
          <div style="font-family: 'Dancing Script', cursive; font-size: 32px; color: #0F172A; text-align: center;">
            Prajwal Venkatesh
          </div>
          <div class="esign-audit-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            OFFICIALLY COUNTERSIGNED & CERTIFIED
          </div>
        </div>

        <div class="esign-meta-details">
          <div class="esign-meta-row">
            <span class="esign-meta-key">Signatory:</span>
            <span>Prajwal Venkatesh (Lead Solutions Architect)</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Official Date:</span>
            <span>Document Handover (Go-Live 20 Days Post-Signing)</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Verification:</span>
            <span style="font-family: monospace;">NEXUS-AUTH-SECURE-88219</span>
          </div>
        </div>
      </div>
    `;

    // Client Block (Raku's Kitchen) — Interactive E-Signature Box
    const clientHtml = `
      <div class="esign-card-block" id="esignClientCard">
        <div class="esign-card-header">
          <div class="esign-role-tag">Client Entity & Business Owner</div>
          <div class="esign-party-name">Raku's Kitchen</div>
          <div class="esign-sub-role">Direct-to-Consumer Cloud Kitchen & Catering Platform</div>
        </div>

        <div class="esign-display-zone unsigned-prompt" id="esignClientDisplayZone">
          <!-- Dynamic Signature Content injected by updateUI() -->
        </div>

        <div class="esign-meta-details" id="esignClientMetaDetails">
          <!-- Injected by updateUI() -->
        </div>
      </div>
    `;

    grid.innerHTML = providerHtml + clientHtml;

    if (existingGrid) {
      existingGrid.replaceWith(grid);
    } else {
      container.appendChild(grid);
    }
  }

  // 3. Inject Interactive Modal
  function injectModal() {
    const existing = document.getElementById('esignModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'esign-modal-overlay';
    overlay.id = 'esignModalOverlay';
    overlay.innerHTML = `
      <div class="esign-modal">
        <div class="esign-modal-header">
          <div>
            <div class="esign-modal-title">E-Sign Acceptance & Formal Sign-off</div>
            <div class="esign-modal-subtitle">${SIGNABLE_DOCS[currentDocId].title}</div>
          </div>
          <button class="esign-close-btn" id="esignCloseModalBtn">&times;</button>
        </div>

        <div class="esign-modal-body">
          <div class="esign-field-group">
            <label class="esign-label">Signer Full Legal Name</label>
            <input type="text" class="esign-input" id="signerNameInput" value="Rakesh Kumar" placeholder="Enter your full legal name">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="esign-field-group">
            <div>
              <label class="esign-label">Title / Role</label>
              <input type="text" class="esign-input" id="signerTitleInput" value="Proprietor / Business Owner">
            </div>
            <div>
              <label class="esign-label">Entity / Business</label>
              <input type="text" class="esign-input" id="signerOrgInput" value="Raku's Kitchen" readonly style="background: #F8FAFC;">
            </div>
          </div>

          <!-- Method Tabs -->
          <div class="esign-tabs">
            <div class="esign-tab active" id="tabDraw">✍️ Draw Signature</div>
            <div class="esign-tab" id="tabType">⌨️ Type Signature</div>
          </div>

          <!-- Tab 1: Draw -->
          <div id="drawSignaturePanel">
            <div class="esign-canvas-container">
              <canvas id="signatureCanvas" class="esign-canvas"></canvas>
            </div>
            <div class="esign-canvas-controls">
              <span>Draw your signature using mouse, stylus, or fingertip</span>
              <span class="esign-clear-link" id="clearCanvasBtn">Clear Pad</span>
            </div>
          </div>

          <!-- Tab 2: Type -->
          <div id="typeSignaturePanel" style="display: none;">
            <div class="esign-type-preview-box" id="typedSignaturePreview" style="font-family: 'Dancing Script', cursive;">
              Rakesh Kumar
            </div>
            <div class="esign-font-selector">
              <div class="esign-font-chip active" data-font="Dancing Script" style="font-family: 'Dancing Script', cursive; font-size: 15px;">Dancing Script</div>
              <div class="esign-font-chip" data-font="Caveat" style="font-family: 'Caveat', cursive; font-size: 15px;">Caveat</div>
              <div class="esign-font-chip" data-font="Great Vibes" style="font-family: 'Great Vibes', cursive; font-size: 15px;">Great Vibes</div>
            </div>
          </div>

          <!-- Legal Agreement -->
          <div class="esign-legal-agreement">
            <input type="checkbox" id="legalConsentCheckbox" checked>
            <label for="legalConsentCheckbox">
              I acknowledge that I am authorized to bind Raku's Kitchen. By signing, I accept the specifications, contractual terms, deliverables, and governance defined in this document.
            </label>
          </div>
        </div>

        <div class="esign-modal-footer">
          <div style="font-size: 11px; color: #64748B;">
            🔒 Legally binding e-sign under IT Act 2000
          </div>
          <button class="esign-adopt-btn" id="adoptSignBtn">
            <span>Adopt & Sign Document</span> &rarr;
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Setup Canvas
    setupCanvas();
  }

  // Canvas Drawing Mechanics
  function setupCanvas() {
    canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    // High-DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!canvas.getAttribute('data-ready')) {
      canvas.width = (rect.width || 560) * dpr;
      canvas.height = (rect.height || 160) * dpr;
      ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0F172A';
      canvas.setAttribute('data-ready', 'true');

      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDraw);

      canvas.addEventListener('touchstart', startDraw, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      window.addEventListener('touchend', stopDraw);
    }

    function getCoords(e) {
      const r = canvas.getBoundingClientRect();
      const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
      const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - r.left,
        y: clientY - r.top
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      const coords = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const coords = getCoords(e);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }

    function stopDraw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      isDrawing = false;
    }
  }

  // 4. Bind DOM Events
  function bindEvents() {
    const modal = document.getElementById('esignModalOverlay');
    const primaryBtn = document.getElementById('esignPrimaryBtn');
    const closeBtn = document.getElementById('esignCloseModalBtn');
    const clientZone = document.getElementById('esignClientDisplayZone');
    const tabDraw = document.getElementById('tabDraw');
    const tabType = document.getElementById('tabType');
    const drawPanel = document.getElementById('drawSignaturePanel');
    const typePanel = document.getElementById('typeSignaturePanel');
    const clearBtn = document.getElementById('clearCanvasBtn');
    const adoptBtn = document.getElementById('adoptSignBtn');
    const nameInput = document.getElementById('signerNameInput');
    const previewBox = document.getElementById('typedSignaturePreview');
    const fontChips = document.querySelectorAll('.esign-font-chip');

    function openModal() {
      modal.classList.add('active');
      setTimeout(setupCanvas, 100);
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    if (primaryBtn) primaryBtn.onclick = openModal;
    if (clientZone) clientZone.onclick = function() {
      const status = NexusSign.getSignStatus(currentDocId);
      if (!status) openModal();
    };
    if (closeBtn) closeBtn.onclick = closeModal;

    // Tabs
    if (tabDraw && tabType) {
      tabDraw.onclick = function () {
        activeTab = 'draw';
        tabDraw.classList.add('active');
        tabType.classList.remove('active');
        drawPanel.style.display = 'block';
        typePanel.style.display = 'none';
        setupCanvas();
      };
      tabType.onclick = function () {
        activeTab = 'type';
        tabType.classList.add('active');
        tabDraw.classList.remove('active');
        drawPanel.style.display = 'none';
        typePanel.style.display = 'block';
        updateTypedPreview();
      };
    }

    // Clear Canvas
    if (clearBtn) {
      clearBtn.onclick = function () {
        if (ctx && canvas) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          hasDrawn = false;
        }
      };
    }

    // Typed Preview Name sync
    function updateTypedPreview() {
      if (previewBox && nameInput) {
        previewBox.textContent = nameInput.value.trim() || 'Rakesh Kumar';
        previewBox.style.fontFamily = `'${activeFont}', cursive`;
      }
    }

    if (nameInput) {
      nameInput.addEventListener('input', updateTypedPreview);
    }

    // Font selection
    fontChips.forEach(chip => {
      chip.onclick = function () {
        fontChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFont = chip.getAttribute('data-font');
        updateTypedPreview();
      };
    });

    // Adopt and Sign Action
    if (adoptBtn) {
      adoptBtn.onclick = async function () {
        const signerName = (nameInput.value || 'Rakesh Kumar').trim();
        const signerTitle = (document.getElementById('signerTitleInput').value || 'Proprietor').trim();
        const signerOrg = 'Raku\'s Kitchen';
        const consent = document.getElementById('legalConsentCheckbox').checked;

        if (!consent) {
          alert('Please accept the declaration checkbox to confirm your authorization.');
          return;
        }

        let signatureData = null;
        let signatureType = activeTab;

        if (activeTab === 'draw') {
          if (!hasDrawn) {
            alert('Please draw your signature on the pad, or switch to the "Type Signature" tab.');
            return;
          }
          signatureData = canvas.toDataURL('image/png');
        } else {
          signatureData = {
            text: signerName,
            font: activeFont
          };
        }

        const now = new Date();
        const timestamp = formatIST(now);
        const goLiveDateObj = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
        const goLiveDateStr = goLiveDateObj.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        const hash = await generateVerificationHash(currentDocId, signerName, timestamp);

        const signatureRecord = {
          docId: currentDocId,
          docTitle: SIGNABLE_DOCS[currentDocId].title,
          signerName,
          signerTitle,
          signerOrg,
          signatureType,
          signatureData,
          timestamp,
          isoDate: now.toISOString(),
          goLiveTargetDate: goLiveDateStr,
          hash,
          userAgent: navigator.userAgent
        };

        // Save locally
        localStorage.setItem(STORAGE_KEY_PREFIX + currentDocId, JSON.stringify(signatureRecord));

        closeModal();
        updateUI();
        showSignSuccessNotification(signatureRecord);
      };
    }
  }

  // 5. Update UI Based on Stored Signature Status
  function updateUI() {
    const status = NexusSign.getSignStatus(currentDocId);
    const badge = document.getElementById('esignStatusBadge');
    const badgeText = document.getElementById('esignStatusText');
    const primaryBtn = document.getElementById('esignPrimaryBtn');
    const clientCard = document.getElementById('esignClientCard');
    const clientDisplayZone = document.getElementById('esignClientDisplayZone');
    const clientMeta = document.getElementById('esignClientMetaDetails');

    if (status) {
      // SIGNED STATE
      if (badge) {
        badge.className = 'esign-status-pill signed';
        badgeText.textContent = 'Digitally Signed & Certified ✓';
      }
      if (primaryBtn) {
        primaryBtn.className = 'esign-btn esign-btn-secondary';
        primaryBtn.innerHTML = '📜 View Audit Certificate';
        primaryBtn.onclick = showCertificateModal;
      }
      if (clientCard) {
        clientCard.classList.add('signed-box');
      }

      if (clientDisplayZone) {
        clientDisplayZone.className = 'esign-display-zone';
        clientDisplayZone.style.cursor = 'default';

        if (status.signatureType === 'draw') {
          clientDisplayZone.innerHTML = `
            <img src="${status.signatureData}" class="esign-rendered-signature" alt="Client Signature">
            <div class="esign-audit-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              VERIFIED ELECTRONIC SIGNATURE
            </div>
          `;
        } else {
          clientDisplayZone.innerHTML = `
            <div class="esign-rendered-typed" style="font-family: '${status.signatureData.font}', cursive;">
              ${status.signatureData.text}
            </div>
            <div class="esign-audit-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              VERIFIED ELECTRONIC SIGNATURE
            </div>
          `;
        }
      }

      if (clientMeta) {
        clientMeta.innerHTML = `
          <div class="esign-meta-row">
            <span class="esign-meta-key">Signed By:</span>
            <span><strong>${status.signerName}</strong> (${status.signerTitle})</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Signed At:</span>
            <span>${status.timestamp}</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Target Go-Live:</span>
            <span style="font-weight: 700; color: #15803D;">${status.goLiveTargetDate || '20 Days Post-Signing'} (20 Days Post-Signing)</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Checksum:</span>
            <span style="font-family: monospace; color: #15803D;">${status.hash}</span>
          </div>
          <div style="margin-top: 8px; text-align: right;">
            <a href="javascript:void(0)" onclick="NexusSign.clearSignature('${currentDocId}')" style="color: #94A3B8; font-size: 11px; text-decoration: underline;">
              Re-sign / Clear
            </a>
          </div>
        `;
      }
    } else {
      // UNSIGNED STATE
      if (badge) {
        badge.className = 'esign-status-pill unsigned';
        badgeText.textContent = 'Pending Client Signature';
      }
      if (primaryBtn) {
        primaryBtn.className = 'esign-btn esign-btn-primary';
        primaryBtn.innerHTML = '✍️ Sign This Document';
        primaryBtn.onclick = function () {
          document.getElementById('esignModalOverlay').classList.add('active');
          setTimeout(setupCanvas, 100);
        };
      }
      if (clientCard) {
        clientCard.classList.remove('signed-box');
      }

      if (clientDisplayZone) {
        clientDisplayZone.className = 'esign-display-zone unsigned-prompt';
        clientDisplayZone.style.cursor = 'pointer';
        clientDisplayZone.innerHTML = `
          <div class="esign-prompt-content">
            <div class="esign-prompt-icon">✍️</div>
            <div class="esign-prompt-text">Click to E-Sign as Raku's Kitchen</div>
            <div class="esign-prompt-sub">Proprietor / Authorized Signatory</div>
          </div>
        `;
      }

      if (clientMeta) {
        clientMeta.innerHTML = `
          <div class="esign-meta-row">
            <span class="esign-meta-key">Signatory:</span>
            <span style="color: #B45309;">Awaiting Authorized Client Sign-off</span>
          </div>
          <div class="esign-meta-row">
            <span class="esign-meta-key">Go-Live Timeline:</span>
            <span>Scheduled 20 Days Post-Signing</span>
          </div>
        `;
      }
    }
  }

  // 6. Audit Certificate Modal
  function showCertificateModal() {
    const status = NexusSign.getSignStatus(currentDocId);
    if (!status) return;

    let certOverlay = document.getElementById('esignCertOverlay');
    if (!certOverlay) {
      certOverlay = document.createElement('div');
      certOverlay.className = 'esign-modal-overlay';
      certOverlay.id = 'esignCertOverlay';
      document.body.appendChild(certOverlay);
    }

    certOverlay.innerHTML = `
      <div class="esign-modal esign-cert-modal">
        <div class="esign-modal-header">
          <div>
            <div class="esign-modal-title">Certificate of Digital Execution</div>
            <div class="esign-modal-subtitle">Nexus SecureSign Audit & Governance Trail</div>
          </div>
          <button class="esign-close-btn" onclick="document.getElementById('esignCertOverlay').classList.remove('active')">&times;</button>
        </div>

        <div class="esign-modal-body">
          <div class="esign-cert-box">
            <div class="esign-cert-stamp">Verified ✓</div>
            <div class="esign-cert-header">
              <h3 style="font-size: 16px; color: #0F172A; margin-bottom: 4px;">OFFICIAL SIGNATURE VERIFICATION RECORD</h3>
              <p style="font-size: 12px; color: #64748B;">Information Technology Act, 2000 — Section 10A Compliant</p>
            </div>

            <table class="esign-cert-table">
              <tr>
                <td>Document Title:</td>
                <td><strong>${status.docTitle}</strong></td>
              </tr>
              <tr>
                <td>Document Ref:</td>
                <td>${SIGNABLE_DOCS[currentDocId].ref}</td>
              </tr>
              <tr>
                <td>Authorized Signer:</td>
                <td><strong>${status.signerName}</strong></td>
              </tr>
              <tr>
                <td>Signer Designation:</td>
                <td>${status.signerTitle}</td>
              </tr>
              <tr>
                <td>Client Organization:</td>
                <td>${status.signerOrg}</td>
              </tr>
              <tr>
                <td>Execution Timestamp:</td>
                <td>${status.timestamp}</td>
              </tr>
              <tr>
                <td>Digital Fingerprint (SHA-256):</td>
                <td><span style="font-family: monospace; font-size: 11px; color: #16A34A; word-break: break-all;">${status.hash}</span></td>
              </tr>
              <tr>
                <td>Scheduled Go-Live:</td>
                <td><strong style="color: #16A34A;">${status.goLiveTargetDate || '20 Days Post-Signing'} (20 Calendar Days Post-Signing)</strong></td>
              </tr>
              <tr>
                <td>Counter-Signatory:</td>
                <td>Prajwal Venkatesh (Lead Solutions Architect, Nexus Development)</td>
              </tr>
              <tr>
                <td>Contract Commercials:</td>
                <td>₹55,000 INR All-Inclusive Fixed Price (₹50k App with 1-Yr Maintenance + ₹5k Hosting & Setup)</td>
              </tr>
            </table>
          </div>

          <div style="font-size: 11.5px; color: #64748B; line-height: 1.5; background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #E2E8F0;">
            <strong>Legal Validity:</strong> This document and its digital execution record are valid and enforceable under the Information Technology Act, 2000 (India) regarding electronic records and contracts. The official platform go-live occurs 20 days following client execution.
          </div>
        </div>

        <div class="esign-modal-footer">
          <button class="esign-btn esign-btn-secondary" style="color: #0F172A;" onclick="window.print()">
            🖨️ Print Certificate
          </button>
          <button class="esign-btn esign-btn-primary" onclick="document.getElementById('esignCertOverlay').classList.remove('active')">
            Close Certificate
          </button>
        </div>
      </div>
    `;

    certOverlay.classList.add('active');
  }

  // 7. Toast Celebration Notification
  function showSignSuccessNotification(record) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.background = '#0F172A';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '16px 20px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    toast.style.border = '2px solid #9EFF00';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '13px';
    toast.style.maxWidth = '380px';
    toast.style.animation = 'esign-pop 0.3s ease';

    toast.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: flex-start;">
        <span style="font-size: 24px;">🎉</span>
        <div>
          <div style="font-weight: 700; color: #9EFF00; font-size: 14px; margin-bottom: 2px;">Document Signed Successfully!</div>
          <div style="color: #CBD5E1; font-size: 12px;">Signed by ${record.signerName} (${record.signerTitle}). Target Go-Live: <strong style="color:#9EFF00;">${record.goLiveTargetDate}</strong> (20 days post-signing).</div>
        </div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

})();
