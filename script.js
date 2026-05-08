let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

const todoForm = document.getElementById('todo-form');
const todoList = document.getElementById('todo-list');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');

function render(filter = 'all', query = '') {
    todoList.innerHTML = '';
    const filtered = tasks.filter(t => {
        const matchesFilter = filter === 'all' || (filter === 'completed' ? t.completed : !t.completed);
        const matchesSearch = t.text.toLowerCase().includes(query.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = `task-item ${t.priority} ${t.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <span>${t.text}</span>
            <div>
                <button onclick="toggleTask(${t.id})">OK</button>
                <button onclick="deleteTask(${t.id})">X</button>
            </div>
        `;
        todoList.appendChild(li);
    });
    updateStats();
}

todoForm.addEventListener('submit', e => {
    e.preventDefault();
    const newTask = {
        id: Date.now(),
        text: document.getElementById('todo-input').value,
        priority: document.getElementById('priority-select').value,
        completed: false
    };
    tasks.push(newTask);
    save();
    todoForm.reset();
});

window.toggleTask = id => {
    tasks = tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t);
    save();
};

window.deleteTask = id => {
    tasks = tasks.filter(t => t.id !== id);
    save();
};

function save() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    render();
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const urgent = tasks.filter(t => t.priority === 'alta' && !t.completed).length;
    document.getElementById('total-tasks').innerText = total;
    document.getElementById('progress-percent').innerText = total ? Math.round((completed/total)*100) + '%' : '0%';
    document.getElementById('urgent-tasks').innerText = urgent;
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
});

searchInput.addEventListener('input', e => render('all', e.target.value));

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.filter-btn.active').classList.remove('active');
        btn.classList.add('active');
        render(btn.dataset.filter);
    });
});

if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
render();
