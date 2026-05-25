// ===== CALCULATOR APP =====
AppLauncher.register('calculator', {
  title: 'Calculator',
  icon: '🧮',

  launch() {
    const id = WM.create({
      title: 'Calculator',
      icon: '🧮',
      width: 300,
      height: 480,
      minWidth: 260,
      minHeight: 420,
      appId: 'calculator',
    });

    const content = WM.getContent(id);
    content.style.overflow = 'hidden';
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:8px;box-sizing:border-box;">
        <div style="background:rgba(0,0,0,0.35);border-radius:8px;padding:10px 14px;text-align:right;flex-shrink:0;">
          <div id="calc-expr-${id}" style="font-size:12px;color:var(--text-muted);min-height:16px;word-break:break-all;"></div>
          <div id="calc-result-${id}" style="font-size:32px;font-weight:300;word-break:break-all;line-height:1.1;">0</div>
        </div>
        <div id="calc-grid-${id}" style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;flex:1;">
          <button class="calc-btn func" data-val="MC">MC</button>
          <button class="calc-btn func" data-val="MR">MR</button>
          <button class="calc-btn func" data-val="M+">M+</button>
          <button class="calc-btn func" data-val="M-">M-</button>

          <button class="calc-btn func" data-val="%">%</button>
          <button class="calc-btn func" data-val="CE">CE</button>
          <button class="calc-btn clear" data-val="C">C</button>
          <button class="calc-btn func" data-val="⌫">⌫</button>

          <button class="calc-btn func" data-val="1/x" style="font-size:11px;">1/x</button>
          <button class="calc-btn func" data-val="x²" style="font-size:11px;">x²</button>
          <button class="calc-btn func" data-val="√" style="font-size:13px;">√</button>
          <button class="calc-btn op" data-val="÷">÷</button>

          <button class="calc-btn" data-val="7">7</button>
          <button class="calc-btn" data-val="8">8</button>
          <button class="calc-btn" data-val="9">9</button>
          <button class="calc-btn op" data-val="×">×</button>

          <button class="calc-btn" data-val="4">4</button>
          <button class="calc-btn" data-val="5">5</button>
          <button class="calc-btn" data-val="6">6</button>
          <button class="calc-btn op" data-val="−">−</button>

          <button class="calc-btn" data-val="1">1</button>
          <button class="calc-btn" data-val="2">2</button>
          <button class="calc-btn" data-val="3">3</button>
          <button class="calc-btn op" data-val="+">+</button>

          <button class="calc-btn func" data-val="+/-" style="font-size:12px;">+/-</button>
          <button class="calc-btn" data-val="0">0</button>
          <button class="calc-btn" data-val=".">.</button>
          <button class="calc-btn equals" data-val="=">=</button>
        </div>
      </div>
    `;

    // Make buttons fill height properly
    const style = document.createElement('style');
    style.textContent = `#${id} .calc-btn { height: 100%; min-height: 36px; font-size: 15px; }`;
    document.head.appendChild(style);

    const exprEl = document.getElementById(`calc-expr-${id}`);
    const resultEl = document.getElementById(`calc-result-${id}`);
    const state = { display: '0', expression: '', operator: null, operand: null, justCalc: false, memory: 0 };

    const updateDisplay = () => { resultEl.textContent = state.display; exprEl.textContent = state.expression; };

    const formatNum = (n) => {
      if (isNaN(n) || !isFinite(n)) return 'Error';
      const s = parseFloat(n.toPrecision(12)).toString();
      return s.length > 14 ? parseFloat(n).toExponential(5) : s;
    };

    const calculate = (a, b, op) => {
      switch (op) {
        case '+': return a + b; case '−': return a - b;
        case '×': return a * b; case '÷': return b !== 0 ? a / b : NaN;
        default: return b;
      }
    };

    const handleBtn = (val) => {
      if ('0123456789'.includes(val)) {
        if (state.justCalc) { state.display = val; state.expression = ''; state.justCalc = false; }
        else state.display = state.display === '0' ? val : state.display + val;
        return updateDisplay();
      }
      switch (val) {
        case '.': if (!state.display.includes('.')) state.display += '.'; break;
        case 'C': state.display='0'; state.expression=''; state.operator=null; state.operand=null; state.justCalc=false; break;
        case 'CE': state.display='0'; break;
        case '⌫': state.display = state.display.length > 1 ? state.display.slice(0,-1) : '0'; break;
        case '+/-': state.display = formatNum(-parseFloat(state.display)); break;
        case '%': state.display = formatNum(parseFloat(state.display)/100); break;
        case 'x²': state.display = formatNum(Math.pow(parseFloat(state.display),2)); state.expression=`sqr(${state.display})`; break;
        case '√': state.display = formatNum(Math.sqrt(parseFloat(state.display))); state.expression=`√(${state.display})`; break;
        case '1/x': state.display = formatNum(1/parseFloat(state.display)); break;
        case '+': case '−': case '×': case '÷':
          if (state.operator && !state.justCalc) state.display = formatNum(calculate(state.operand, parseFloat(state.display), state.operator));
          state.operand = parseFloat(state.display); state.operator = val;
          state.expression = state.display + ' ' + val; state.justCalc = false; state.display = '0'; break;
        case '=':
          if (state.operator && state.operand !== null) {
            const r = calculate(state.operand, parseFloat(state.display), state.operator);
            state.expression = state.operand + ' ' + state.operator + ' ' + state.display + ' =';
            state.display = formatNum(r); state.operator = null; state.operand = null; state.justCalc = true;
          } break;
        case 'MC': state.memory=0; break;
        case 'MR': state.display=formatNum(state.memory); break;
        case 'M+': state.memory+=parseFloat(state.display); break;
        case 'M-': state.memory-=parseFloat(state.display); break;
      }
      updateDisplay();
    };

    document.getElementById(`calc-grid-${id}`).addEventListener('click', e => {
      const btn = e.target.closest('.calc-btn');
      if (btn) handleBtn(btn.dataset.val);
    });

    document.getElementById(id).addEventListener('keydown', e => {
      const map = {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        '.':'.', '+':'+', '-':'−', '*':'×', '/':'÷', 'Enter':'=', '=':'=',
        'Backspace':'⌫', 'Escape':'C', 'Delete':'CE', '%':'%'};
      if (map[e.key]) { e.preventDefault(); handleBtn(map[e.key]); }
    });
  }
});
