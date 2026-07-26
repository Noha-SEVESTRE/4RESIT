<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getCurrentUser } from "../services/authService";
import {
  createCookbookMessage,
  deleteCookbookMessage,
  getCookbookMessages,
  type CookbookMessage
} from "../services/discussionService";
import {
  connectRealtime,
  disconnectRealtime,
  joinCookbookRoom,
  leaveCookbookRoom,
  onCookbookMessageCreated,
  onCookbookMessageDeleted,
  onCookbookUpdated
} from "../services/socketService";

const props = defineProps<{
  cookbookId: string;
  role: string;
  canComment: boolean;
}>();

const messages = ref<CookbookMessage[]>([]);
const content = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const isRealtimeConnected = ref(false);
const emit = defineEmits<{
  (event: "cookbookUpdated"): void;
}>();
const errorMessage = ref("");
const currentUserId = ref("");

const canDeleteAllMessages = computed(() => props.role === "OWNER");

function canDeleteMessage(message: CookbookMessage) {
  return canDeleteAllMessages.value || (props.canComment && message.author.id === currentUserId.value);
}

let removeCreatedListener: (() => void) | null = null;
let removeDeletedListener: (() => void) | null = null;
let removeUpdatedListener: (() => void) | null = null;

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

function addOrUpdateMessage(message: CookbookMessage) {
  const exists = messages.value.some((item) => item.id === message.id);

  if (exists) {
    messages.value = messages.value.map((item) => item.id === message.id ? message : item);
    return;
  }

  messages.value = [...messages.value, message];
}

function removeMessageFromList(messageId: string) {
  messages.value = messages.value.filter((message) => message.id !== messageId);
}

async function loadMessages() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getCookbookMessages(token, props.cookbookId);
    messages.value = response.messages;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les messages";
  } finally {
    isLoading.value = false;
  }
}

function setupRealtime() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const socket = connectRealtime(token);

  removeCreatedListener = onCookbookMessageCreated((payload) => {
    if (payload.cookbookId !== props.cookbookId) {
      return;
    }

    addOrUpdateMessage(payload.message);
  });

  removeDeletedListener = onCookbookMessageDeleted((payload) => {
    if (payload.cookbookId !== props.cookbookId) {
      return;
    }

    removeMessageFromList(payload.messageId);
  });

  removeUpdatedListener = onCookbookUpdated((payload) => {
    if (payload.cookbookId !== props.cookbookId) {
      return;
    }

    emit("cookbookUpdated");
  });

  socket.on("connect", () => {
    isRealtimeConnected.value = true;
    joinCookbookRoom(props.cookbookId);
  });

  socket.on("disconnect", () => {
    isRealtimeConnected.value = false;
  });

  socket.on("cookbook:error", (payload: { message?: string }) => {
    errorMessage.value = payload.message ?? "Erreur de connexion temps réel";
  });

  if (socket.connected) {
    isRealtimeConnected.value = true;
    joinCookbookRoom(props.cookbookId);
  }
}

async function submitMessage() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!props.canComment) {
    errorMessage.value = "Votre rôle permet uniquement de lire les messages";
    return;
  }

  if (!content.value.trim()) {
    errorMessage.value = "Le message ne peut pas être vide";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    const response = await createCookbookMessage(token, props.cookbookId, content.value.trim());
    content.value = "";
    addOrUpdateMessage(response.message);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'envoyer le message";
  } finally {
    isSaving.value = false;
  }
}

async function removeMessage(message: CookbookMessage) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!canDeleteMessage(message)) {
    errorMessage.value = "Vous ne pouvez pas supprimer ce message";
    return;
  }

  const confirmed = window.confirm("Supprimer ce message ?");

  if (!confirmed) {
    return;
  }

  try {
    await deleteCookbookMessage(token, props.cookbookId, message.id);
    removeMessageFromList(message.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de supprimer le message";
  }
}

async function loadCurrentUser() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  try {
    const response = await getCurrentUser(token);
    currentUserId.value = response.user.id;
  } catch (_error) {
    currentUserId.value = "";
  }
}

watch(
    () => props.cookbookId,
    async (cookbookId, previousCookbookId) => {
      if (previousCookbookId) {
        leaveCookbookRoom(previousCookbookId);
      }

      await loadMessages();

      if (isRealtimeConnected.value) {
        joinCookbookRoom(cookbookId);
      }
    }
);

onMounted(async () => {
  await Promise.all([
    loadCurrentUser(),
    loadMessages()
  ]);

  setupRealtime();
});

onBeforeUnmount(() => {
  leaveCookbookRoom(props.cookbookId);
  removeCreatedListener?.();
  removeDeletedListener?.();
  disconnectRealtime();
  removeUpdatedListener?.();
});
</script>

<template>
  <div class="messages-panel">
    <div class="messages-header">
      <div>
        <h5>Messages du cookbook</h5>
      </div>

      <button type="button" @click="loadMessages">
        Actualiser
      </button>
    </div>

    <form v-if="canComment" class="message-form" @submit.prevent="submitMessage">
      <input v-model="content" type="text" placeholder="Écrire un message">

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Envoi..." : "Envoyer" }}
      </button>
    </form>

    <p v-if="errorMessage" class="message-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="message-info">
      Chargement des messages...
    </p>

    <p v-else-if="!messages.length" class="message-info">
      Aucun message dans ce cookbook.
    </p>

    <div v-else class="message-list">
      <div v-for="message in messages" :key="message.id" class="message-item">
        <div>
          <strong>{{ message.author.displayName }}</strong>
          <span>{{ formatDate(message.createdAt) }}</span>
          <p>{{ message.content }}</p>
        </div>

        <button v-if="canDeleteMessage(message)" class="message-delete-button" type="button" @click="removeMessage(message)">
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-panel {
  display: grid;
  gap: 12px;
}

.messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.messages-header h5 {
  margin: 0 0 4px;
  color: #2f241d;
  font-size: 17px;
}

.messages-header button,
.message-form button,
.message-item button {
  border: 1px solid #e2d2bd;
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
  cursor: pointer;
  background: #f8efe4;
  color: #2f241d;
  box-shadow: none;
}

.message-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2d2bd;
  border-radius: 18px;
  background: #fffaf2;
}

.message-form input {
  border: 1px solid #d9c7b2;
  border-radius: 14px;
  padding: 10px 12px;
  background: #fffdf8;
  color: #2f241d;
}

.message-form input:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.message-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 800;
}

.message-info {
  margin: 0;
  color: #5f5148;
  font-weight: 800;
}

.message-list {
  display: grid;
  gap: 10px;
}

.message-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #d9c7b2;
  border-radius: 16px;
  padding: 12px;
  background: #fffaf2;
}

.message-item div {
  display: grid;
  gap: 4px;
}

.message-item strong {
  color: #2f241d;
  font-weight: 900;
}

.message-item span {
  color: #6b5f55;
  font-size: 12px;
  font-weight: 700;
}

.message-item p {
  margin: 0;
  color: #3b2d24;
  line-height: 1.45;
}

.message-item .message-delete-button {
  background: #fff1f4;
  color: #be123c;
  border-color: #f3c6cf;
}

@media (max-width: 700px) {
  .messages-header,
  .message-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .message-form {
    grid-template-columns: 1fr;
  }
}

.message-delete-button {
  width: auto;
  min-width: 0;
  height: 34px;
  border: 1px solid #f3c6cf;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  background: #fff1f4;
  color: #be123c;
  align-self: center;
  white-space: nowrap;
  box-shadow: none;
  line-height: 1;
}

.message-delete-button:hover {
  background: #ffe4ea;
}
</style>