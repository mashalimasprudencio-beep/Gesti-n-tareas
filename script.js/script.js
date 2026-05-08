
const STORAGE_KEY = "gestion_tareas_v1";

const PRIORITIES = Object.freeze({
  ALTA: "alta",
  MEDIA: "media",
  BAJA: "baja",
});

const FILTERS = Object.freeze({
  ALL: "todas",
  PENDING: "pendientes",
  COMPLETED: "completadas",
});

// ─────────────────────────────────────────────
// 2. ESTRUCTURA DEL OBJETO TAREA (Task Schema)
// ─────────────────────────────────────────────

/**
 * Crea un objeto de tarea con todos sus campos.
 *
 * @param {string} name       - Nombre/descripción de la tarea
 * @param {string} priority   - Prioridad: "alta" | "media" | "baja"
 * @returns {Object}          - Objeto tarea normalizado
 *
 * Ejemplo de objeto generado:
 * {
 *   id: "1718392847302-k7f2q",
 *   name: "Diseñar el logo",
 *   priority: "alta",
 *   completed: false,
 *   createdAt: "2025-06-14T12:00:47.302Z",
 *   completedAt: null
 * }
 */
function createTask(name, priority = PRIORITIES.MEDIA) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("El nombre de la tarea no puede estar vacío.");
  }

  const validPriorities = Object.values(PRIORITIES);
  if (!validPriorities.includes(priority)) {
    throw new Error(
      `Prioridad inválida: "${priority}". Usa: ${validPriorities.join(", ")}`
    );
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Carga las tareas desde localStorage.
 * Devuelve un array vacío si no hay datos o si ocurre un error de parseo.
 *
 * @returns {Array} - Array de objetos tarea
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Validación defensiva: asegura que sea un array
    if (!Array.isArray(parsed)) {
      console.warn("taskManager: datos corruptos, reiniciando almacenamiento.");
      return [];
    }

    return parsed;
  } catch (error) {
    console.error("taskManager: error al leer localStorage →", error);
    return [];
  }
}

/**
 * Guarda el array completo de tareas en localStorage.
 *
 * @param {Array} tasks - Array de objetos tarea a persistir
 */
function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    // Puede ocurrir si el storage está lleno (QuotaExceededError)
    console.error("taskManager: error al guardar en localStorage →", error);
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Agrega una nueva tarea al array y la persiste.
 *
 * @param {string} name     - Nombre de la tarea
 * @param {string} priority - "alta" | "media" | "baja"
 * @returns {Object}        - La tarea recién creada
 */
function addTask(name, priority) {
  const tasks = loadTasks();
  const newTask = createTask(name, priority);
  tasks.push(newTask);
  saveTasks(tasks);

  // Emite evento para que la UI actualice la vista
  _emit("task:added", newTask);

  return newTask;
}

/**
 * Alterna el estado completed de una tarea (toggle).
 * Registra la fecha de completado cuando se marca como lista.
 *
 * @param {string} id - ID de la tarea a actualizar
 * @returns {Object|null} - Tarea actualizada o null si no se encontró
 */
function toggleTask(id) {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    console.warn(`taskManager: tarea con id "${id}" no encontrada.`);
    return null;
  }

  tasks[index].completed = !tasks[index].completed;
  tasks[index].completedAt = tasks[index].completed
    ? new Date().toISOString()
    : null;

  saveTasks(tasks);
  _emit("task:updated", tasks[index]);

  return tasks[index];
}

/**
 * Elimina una tarea por su ID.
 *
 * @param {string} id - ID de la tarea a eliminar
 * @returns {boolean} - true si se eliminó, false si no existía
 */
function deleteTask(id) {
  const tasks = loadTasks();
  const filtered = tasks.filter((t) => t.id !== id);

  if (filtered.length === tasks.length) {
    console.warn(`taskManager: tarea con id "${id}" no encontrada.`);
    return false;
  }

  saveTasks(filtered);
  _emit("task:deleted", { id });

  return true;
}

/**
 * Edita el nombre y/o prioridad de una tarea existente.
 *
 * @param {string} id      - ID de la tarea a editar
 * @param {Object} changes - Objeto con los campos a modificar: { name?, priority? }
 * @returns {Object|null}  - Tarea actualizada o null si no existe
 */
function editTask(id, changes = {}) {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) return null;

  // Solo actualiza campos permitidos
  if (changes.name !== undefined) {
    if (typeof changes.name !== "string" || changes.name.trim() === "") {
      throw new Error("El nombre no puede estar vacío.");
    }
    tasks[index].name = changes.name.trim();
  }

  if (changes.priority !== undefined) {
    if (!Object.values(PRIORITIES).includes(changes.priority)) {
      throw new Error("Prioridad inválida.");
    }
    tasks[index].priority = changes.priority;
  }

  saveTasks(tasks);
  _emit("task:updated", tasks[index]);

  return tasks[index];
}
/**
 * Función central de filtrado.
 * Combina filtro de estado + búsqueda por texto en un solo paso.
 *
 * @param {Object} options
 * @param {string} options.filter    - "todas" | "pendientes" | "completadas"
 * @param {string} options.search    - Texto a buscar (case-insensitive)
 * @param {string} options.priority  - Filtrar por prioridad (opcional)
 * @returns {Array} - Tareas que cumplen todos los criterios
 *
 * Ejemplo de uso:
 *   getFilteredTasks({ filter: "pendientes", search: "logo" })
 */
function getFilteredTasks({
  filter = FILTERS.ALL,
  search = "",
  priority = null,
} = {}) {
  let tasks = loadTasks();

  // — Filtro por estado —
  if (filter === FILTERS.PENDING) {
    tasks = tasks.filter((t) => !t.completed);
  } else if (filter === FILTERS.COMPLETED) {
    tasks = tasks.filter((t) => t.completed);
  }

  // — Filtro por prioridad —
  if (priority && Object.values(PRIORITIES).includes(priority)) {
    tasks = tasks.filter((t) => t.priority === priority);
  }

  // — Búsqueda en tiempo real —
  if (search.trim() !== "") {
    const query = search.trim().toLowerCase();
    tasks = tasks.filter((t) => t.name.toLowerCase().includes(query));
  }

  return tasks;
}

/**
 * Obtiene TODAS las tareas sin filtrar.
 *
 * @returns {Array}
 */
function getAllTasks() {
  return loadTasks();
}
/**
 * Calcula todas las métricas necesarias para el panel de estadísticas.
 *
 * @returns {Object} - Objeto con todas las estadísticas
 *
 * Ejemplo de retorno:
 * {
 *   total: 10,
 *   completed: 6,
 *   pending: 4,
 *   progressPercent: 60,
 *   urgent: 3,          ← tareas con prioridad ALTA pendientes
 *   byPriority: { alta: 3, media: 5, baja: 2 }
 * }
 */
function getStats() {
  const tasks = loadTasks();

  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Urgentes = prioridad ALTA y aún pendientes
  const urgent = tasks.filter(
    (t) => t.priority === PRIORITIES.ALTA && !t.completed
  ).length;

  // Desglose por prioridad (total, sin importar estado)
  const byPriority = {
    [PRIORITIES.ALTA]: tasks.filter((t) => t.priority === PRIORITIES.ALTA).length,
    [PRIORITIES.MEDIA]: tasks.filter((t) => t.priority === PRIORITIES.MEDIA).length,
    [PRIORITIES.BAJA]: tasks.filter((t) => t.priority === PRIORITIES.BAJA).length,
  };

  return {
    total,
    completed,
    pending,
    progressPercent,
    urgent,
    byPriority,
  };
}
const _listeners = {};
/**
 * Emite un evento interno.
 * @private
 */
function _emit(event, data) {
  if (_listeners[event]) {
    _listeners[event].forEach((cb) => cb(data));
  }
}

/**
 * Suscribe una función callback a un evento del módulo.
 * El UI/UX Designer usará esto para re-renderizar cuando cambien las tareas.
 *
 * Eventos disponibles:
 *  - "task:added"    → recibe la tarea nueva
 *  - "task:updated"  → recibe la tarea modificada
 *  - "task:deleted"  → recibe { id }
 *
 * @param {string}   event    - Nombre del evento
 * @param {Function} callback - Función a ejecutar
 *
 * Ejemplo de uso en la UI:
 *   TaskManager.on("task:added", () => renderTaskList());
 */
function on(event, callback) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(callback);
}

/**
 * Desuscribe un callback de un evento.
 *
 * @param {string}   event    - Nombre del evento
 * @param {Function} callback - La misma referencia usada en on()
 */
function off(event, callback) {
  if (!_listeners[event]) return;
  _listeners[event] = _listeners[event].filter((cb) => cb !== callback);
}
/**
 * API pública del módulo.
 * El resto del equipo importará este objeto para usar la lógica.
 *
 * Uso (en otros archivos JS):
 *   import TaskManager from "./taskManager.js";
 *   TaskManager.addTask("Revisar PR", TaskManager.PRIORITIES.ALTA);
 */
const TaskManager = {
  // Constantes
  PRIORITIES,
  FILTERS,

  // CRUD
  addTask,
  toggleTask,
  deleteTask,
  editTask,

  // Consultas
  getAllTasks,
  getFilteredTasks,
  getStats,

  // Persistencia directa (para debug/tests)
  loadTasks,
  saveTasks,
  clearStorage,

  // Eventos
  on,
  off,
};

export default TaskManager;