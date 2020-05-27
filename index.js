const elem = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        const [{ tag = 'div', attrs = {}, content, events = {}, ref }] = args;

        const element = document.createElement(tag);

        for (const [key, value] of Object.entries(attrs))
            element.setAttribute(key, value);

        for (const [event, cb] of Object.entries(events))
            element.addEventListener(event, cb);

        if (typeof content === 'string' || typeof content === 'number')
            element.innerText = String(content);
        if (typeof content === 'object')
            for (const currentContent of [].concat(content).filter(Boolean))
                element.appendChild(elem(currentContent));

        if (getType(ref) === 'function')
            ref(element);

        return element;
    }

    if (args.length < 0) return null;

    const [tag, attrs, content, events] = args;

    return elem({
        tag,
        attrs,
        content,
        events
    });
}

const getType = val => {
    const type = typeof val;

    if (type !== 'object') return type;
    if (val === null) return 'null';
    return Array.isArray(val) ? 'array' : type;
}

const clone = val => {
    try { return JSON.parse(JSON.stringify(val)); } catch (e) {}

    if (!['object', 'array'].includes(getType(val))) return val;

    const newVal = Array.isArray(val) ? [...val] : { ...val };

    const stack = [newVal];
    while (stack.length) {
        const val = stack.pop();
        for (const [key, value] of Object.entries(val)) {
            const type = getType(value);

            if (type === 'object') {
                val[key] = { ...value };
                stack.push(val[key]);
            }

            if (type === 'array') {
                newVal[key] = [...value];
                stack.push(val[key]);
            }
        }
    }

    return newVal;
}

const generateMatrix = (w, h, emptyValue = 0) =>
    new Array(h).fill(0).map(() =>
        new Array(w).fill(0).map(() => clone(emptyValue))
    );

const forEachMatrix = (m, cb) => m.forEach((row, y) => row.forEach((cell, x) => cb(cell, [x, y], row, m)));

const cn = (...args) => {
    const [classname, { mod = '_', elem = '__' } = {}] = args;

    return (...args) => {
        let element = '';
        let [modsOrElemName, mods = {}] = args;

        if (getType(modsOrElemName) === 'object')
            mods = modsOrElemName;
        if (getType(modsOrElemName) === 'string')
            element = modsOrElemName;

        const basename = element ? `${classname}${elem}${element}` : classname;
        const results = [basename];

        for (const [key, value] of Object.entries(mods))
            if (getType(value) === 'boolean')
                value && results.push(`${basename}${mod}${key}`);
            else
                results.push(`${basename}${mod}${key}${mod}${value}`);

        return results.join(' ');
    }
}

const random = (min, max) => Math.random() * (max - min) | 0;

const matrix = generateMatrix(24, 24, { value: 0, hasBomb: false, opened: false, ref: null, checked: false });
forEachMatrix(matrix, (cell, [x, y]) => {
    cell.x = x;
    cell.y = y;
});

const aroundCoords = (x, y) => [
    [x - 1, y - 1], [x, y - 1], [x + 1, y - 1],
    [x - 1, y]/*   Center   */, [x + 1, y],
    [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]
];

const stepAsideCoords = (x, y) => [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]

let i = 0;
while (i < 120) {
    const y = random(0, matrix.length);
    const x = random(0, matrix[0].length);

    if (matrix[y][x].hasBomb) continue;

    let count = 0;
    aroundCoords(x, y).forEach(([x, y]) => {
        if (matrix[y] === undefined) return;
        if (matrix[y][x] === undefined) return;
        if (!matrix[y][x].hasBomb) return;

        count++;
    });

    if (count >= 6) continue;

    matrix[y][x].hasBomb = true;
    i++;
}

for (const row of matrix)
    for (const { x, y, hasBomb } of row)
        if (hasBomb)
            aroundCoords(x, y).forEach(([x, y]) => {
                if (matrix[y] === undefined) return;
                if (matrix[y][x] === undefined) return;
                if (matrix[y][x].hasBomb) return;
                matrix[y][x].value++;
            });

const cnMinesweeper = cn('minesweeper');

const checkForWin = () => {
    for (const row of matrix)
        for (const cell of row)
            if (cell.hasBomb && !cell.checked)
                return false;
            else if (!cell.hasBomb && !cell.opened)
                return false;

    return true;
}

const tableRef = { current: null };

document.body.appendChild(elem({
    tag: 'div',
    attrs: { class: cnMinesweeper() },
    content: [
        {
            tag: 'table',
            attrs: { class: cnMinesweeper('game') },
            ref: ref => tableRef.current = ref,
            content: matrix.map((row, y) => ({
                tag: 'tr',
                attrs: { class: cnMinesweeper('tr') },
                content: row.map((cell, x) => ({
                    ref: ref => cell.ref = ref,
                    tag: 'td',
                    attrs: { class: cnMinesweeper('td') },
                    events: {
                        contextmenu: event => {
                            event.preventDefault();

                            if (cell.opened) return;

                            cell.ref.classList.toggle(cnMinesweeper('td', { 'checked': true }).split(' ').pop());
                            cell.checked = !cell.checked;

                            if (checkForWin())
                                tableRef.current.classList.add(...cnMinesweeper('game', { won: true }).split(' '));
                        },
                        click: () => {
                            if (cell.checked) {
                                cell.ref.classList.toggle(cnMinesweeper('td', { 'checked': true }).split(' ').pop());
                                cell.checked = !cell.checked;

                                return;
                            }

                            if (cell.hasBomb)
                                return forEachMatrix(matrix, cell => {
                                    cell.opened = true;

                                    cell.ref.classList.add(...cnMinesweeper('td', {
                                        'with-bomb': cell.hasBomb,
                                        opened: true,
                                        type: cell.value
                                    }).split(' '));

                                    tableRef.current.classList.add(...cnMinesweeper('game', { loss: true }).split(' '));
                                });

                            const toOpen = [[x, y]];

                            const stack = [...toOpen];
                            while (stack.length)
                                stepAsideCoords(...stack.pop()).forEach(([x, y]) => {
                                    if (matrix[y] === undefined) return;
                                    if (matrix[y][x] === undefined) return;

                                    if (!matrix[y][x].hasBomb && !matrix[y][x].opened) {
                                        matrix[y][x].opened = true;

                                        stack.push([x, y]);
                                        toOpen.push([x, y]);
                                    }
                                });

                            for (const [x, y] of toOpen) {
                                const { value, ref } = matrix[y][x];

                                ref.classList.add(...cnMinesweeper('td', { type: value, opened: true }).split(' '));

                                if (value !== 0)
                                    ref.innerText = value;
                            }

                            if (checkForWin())
                                tableRef.current.classList.add(...cnMinesweeper('game', { won: true }).split(' '));
                        }
                    }
                }))
            }))
        }
    ]
}));
