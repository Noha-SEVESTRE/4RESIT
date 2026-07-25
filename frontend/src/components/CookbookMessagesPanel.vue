<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
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
  onCookbookMessageDeleted
} from "../services/socketService";

const props = defineProps<{
  cookbookId: string;
}>();

const messages = ref<CookbookMessage[]>([]);
const content = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const isRealtimeConnected = ref(false);
const errorMessage = ref("");

let removeCreatedListener: (() => void) | null = null;
let removeDeletedListener: (() => void) | null = null;

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
  await loadMessages();
  setupRealtime();
});

onBeforeUnmount(() => {
  leaveCookbookRoom(props.cookbookId);
  removeCreatedListener?.();
  removeDeletedListener?.();
  disconnectRealtime();
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

    <form class="message-form" @submit.prevent="submitMessage">
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

        <button type="button" @click="removeMessage(message)">
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
}

.realtime-status {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 900;
}

.realtime-status.connected {
  background: #ecfdf5;
  color: #047857;
}

.realtime-status.disconnected {
  background: #fffbeb;
  color: #92400e;
}

.messages-header button,
.message-form button,
.message-item button {
  border: 0;
  border-radius: 999px;
  padding: 8px 11px;
  font-weight: 800;
  cursor: pointer;
  background: #f3f4f6;
  color: #111827;
}

.message-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.message-form input {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 10px 12px;
}

.message-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

.message-info {
  margin: 0;
  color: #6b7280;
  font-weight: 700;
}

.message-list {
  display: grid;
  gap: 10px;
}

.message-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
}

.message-item div {
  display: grid;
  gap: 4px;
}

.message-item span {
  color: #6b7280;
  font-size: 12px;
}

.message-item p {
  margin: 0;
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
</style>