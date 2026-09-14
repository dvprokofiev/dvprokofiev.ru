import { elementsData } from './data.js';

// ── Constants ──

const SHELL_NAMES = ['K (1)', 'L (2)', 'M (3)', 'N (4)', 'O (5)', 'P (6)', 'Q (7)'];

const CATEGORY_COLORS = [
    ['noble gas',            'var(--noble-gas)'],
    ['alkaline earth metal', 'var(--alkaline-earth)'],
    ['alkali metal',         'var(--alkali-metal)'],
    ['transition metal',     'var(--transition-metal)'],
    ['lanthanide',           'var(--lanthanide)'],
    ['actinide',             'var(--actinide)'],
    ['metalloid',            'var(--metalloid)'],
    ['halogen',              'var(--halogen)'],
    ['nonmetal',             'var(--nonmetal)'],
    ['post-transition metal','var(--metal)'],
];

const A_GROUPS = new Set([1, 2, 13, 14, 15, 16, 17, 18]);

// Maps IUPAC group → short-form column (offset by 1 for period header col)
const GROUP_TO_COL = {
    1: 2, 11: 2,
    2: 3, 12: 3,
    3: 4, 13: 4,
    4: 5, 14: 5,
    5: 6, 15: 6,
    6: 7, 16: 7,
    7: 8, 17: 8,
    8: 9,
    9: 10,
    10: 11, 18: 11,
};

// ── Helpers ──

function getCategoryColor(category) {
    if (!category) return 'var(--unknown)';
    const c = category.toLowerCase();
    for (const [key, val] of CATEGORY_COLORS) {
        if (c.includes(key)) return val;
    }
    return 'var(--unknown)';
}

function getShortFormGrid(el) {
    const col = GROUP_TO_COL[el.group];
    const subgroup = A_GROUPS.has(el.group) ? 'a' : 'b';

    const p = el.period;
    let logicalRow;
    if (p <= 3) {
        logicalRow = p;
    } else {
        // Periods 4–7 split into two rows each: even row = d+s, odd row = p
        const base = 4 + (p - 4) * 2;
        logicalRow = el.group <= 10 ? base : base + 1;
    }

    return { col, row: logicalRow + 1, subgroup };
}

function isFBlock(n) {
    return (n >= 58 && n <= 71) || (n >= 90 && n <= 103);
}

// ── SVG Bohr model math ──

function shellRadius(index, total) {
    const step = total > 0 ? 160 / total : 0;
    return 35 + index * step;
}

function electronPos(shellIdx, total, eIdx, eTotal) {
    const r = shellRadius(shellIdx, total);
    const angle = (eIdx / eTotal) * 2 * Math.PI - Math.PI / 2;
    return {
        x: 200 + r * Math.cos(angle),
        y: 200 + r * Math.sin(angle),
    };
}

// ── DOM helpers ──

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function svgEl(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

// ── Build table ──

document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('periodic-table');
    const fBlock = document.getElementById('f-block-container');
    const modal = document.getElementById('element-modal');
    const closeBtn = document.getElementById('close-modal');

    // Group headers I–VII
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    roman.forEach((name, i) => {
        const h = el('div', 'grid-header', name);
        h.style.gridColumn = i + 2;
        h.style.gridRow = 1;
        table.appendChild(h);
    });

    // Group VIII header (spans 3 cols)
    const h8 = el('div', 'grid-header', 'VIII');
    h8.style.gridColumn = '9 / span 3';
    h8.style.gridRow = 1;
    table.appendChild(h8);

    // Period headers
    [
        { p: 1, r: 2, span: 1 },
        { p: 2, r: 3, span: 1 },
        { p: 3, r: 4, span: 1 },
        { p: 4, r: 5, span: 2 },
        { p: 5, r: 7, span: 2 },
        { p: 6, r: 9, span: 2 },
        { p: 7, r: 11, span: 2 },
    ].forEach(({ p, r, span }) => {
        const h = el('div', 'grid-header period-header', p);
        h.style.gridColumn = 1;
        h.style.gridRow = `${r} / span ${span}`;
        table.appendChild(h);
    });

    // Elements
    elementsData.forEach(data => {
        const cell = el('div', 'element');
        cell.style.backgroundColor = getCategoryColor(data.category);

        // Top row: number + mass
        const top = el('div', 'top-row');
        top.appendChild(el('span', 'number', data.atomicNumber));
        const massText = typeof data.atomicMass === 'number'
            ? data.atomicMass.toFixed(3)
            : data.atomicMass;
        top.appendChild(el('span', 'mass', massText));

        cell.appendChild(top);
        cell.appendChild(el('span', 'symbol', data.symbol));
        cell.appendChild(el('span', 'name', data.ruName || data.name));

        cell.addEventListener('click', () => openModal(data));

        if (isFBlock(data.atomicNumber)) {
            fBlock.appendChild(cell);
        } else {
            const g = getShortFormGrid(data);
            cell.style.gridColumn = g.col;
            cell.style.gridRow = g.row;
            cell.classList.add(
                g.col >= 9 ? 'subgroup-viii'
                : g.subgroup === 'a' ? 'subgroup-a'
                : 'subgroup-b'
            );
            table.appendChild(cell);
        }
    });

    // ── Modal ──

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    function openModal(data) {
        document.getElementById('modal-title').textContent = data.ruName || data.name;
        document.getElementById('modal-subtitle').textContent =
            `${data.name} (${data.symbol}) — Атомный номер: ${data.atomicNumber}`;

        // Electron levels list
        const list = document.getElementById('electron-list');
        list.innerHTML = '';
        if (data.shells?.length) {
            data.shells.forEach((count, i) => {
                const li = el('li');
                li.appendChild(el('span', null, `Уровень ${SHELL_NAMES[i] || i + 1}`));
                const b = el('span', null, `${count} e⁻`);
                b.style.fontWeight = 'bold';
                li.appendChild(b);
                list.appendChild(li);
            });
        } else {
            list.appendChild(el('li', null, 'Нет данных'));
        }

        // SVG Bohr model
        const svg = document.getElementById('bohr-svg');
        svg.innerHTML = '';

        svg.appendChild(svgEl('circle', { cx: 200, cy: 200, r: 25, fill: '#ff6b6b' }));
        svg.appendChild(svgEl('text', {
            x: 200, y: 205,
            'text-anchor': 'middle',
            fill: 'white', 'font-weight': 'bold', 'font-size': 20,
        })).textContent = '+';

        if (data.shells) {
            const total = data.shells.length;
            data.shells.forEach((electrons, i) => {
                svg.appendChild(svgEl('circle', {
                    cx: 200, cy: 200,
                    r: shellRadius(i, total),
                    fill: 'none', stroke: '#ccc', 'stroke-width': 1,
                }));

                const g = svgEl('g', { class: 'electron-shell' });
                const dur = 5 + i * 3;
                const dir = i % 2 === 0 ? 'normal' : 'reverse';
                g.style.animation = `rotateShell ${dur}s linear infinite ${dir}`;

                for (let e = 0; e < electrons; e++) {
                    const { x, y } = electronPos(i, total, e, electrons);
                    g.appendChild(svgEl('circle', { cx: x, cy: y, r: 4, fill: '#4dabf7' }));
                }
                svg.appendChild(g);
            });
        }

        modal.classList.remove('hidden');
    }
});
