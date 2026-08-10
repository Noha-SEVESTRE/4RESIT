<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { getCurrentUser, type User } from "../services/authService";
import { getStoredToken } from "../utils/authToken";
import {createRecipeComment, deleteRecipeComment, getRecipeComments, type RecipeComment} from "../services/discussionService";
import type { CookbookRole } from "../types/cookbook";
import { formatDateTime } from "../utils/date";
import {getErrorMessage} from "../utils/error.ts";

const props = withDefaults(defineProps<{
  recipeId: string;
  canComment?: boolean;
  role?: CookbookRole;
}>(), {
  canComment: true,
  role: "EDITOR"
});

const comments = ref<RecipeComment[]>([]);
const currentUser = ref<User | null>(null);
const content = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");

const canWrite = computed(() => {
  return props.canComment && props.role !== "READER";
});

function canDelete(comment: RecipeComment) {
  return (
      props.role === "OWNER" ||
      (
          (props.role === "EDITOR" || props.role === "COMMENTATOR") &&
          comment.author.id === currentUser.value?.id
      )
  );
}

async function loadCurrentUser() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  try {
    const response = await getCurrentUser(token);
    currentUser.value = response.user;
  } catch (_error) {
    currentUser.value = null;
  }
}

async function loadComments() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getRecipeComments(
        token,
        props.recipeId
    );

    comments.value = response.comments;
  } catch (error) {
    errorMessage.value = getErrorMessage(error,"Impossible de charger les commentaires")
  } finally {
    isLoading.value = false;
  }
}

async function submitComment() {
  if (!canWrite.value) {
    return;
  }

  if (!content.value.trim()) {
    errorMessage.value = "Le commentaire ne peut pas être vide";
    return;
  }

  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    const response = await createRecipeComment(
        token,
        props.recipeId,
        content.value.trim()
    );

    comments.value.push(response.comment);
    content.value = "";
  } catch (error) {
    errorMessage.value = getErrorMessage(error,"Impossible d'ajouter le commentaire")
  } finally {
    isSaving.value = false;
  }
}

async function removeComment(comment: RecipeComment) {
  const confirmed = window.confirm(
      "Supprimer ce commentaire ?"
  );

  if (!confirmed) {
    return;
  }

  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  errorMessage.value = "";

  try {
    await deleteRecipeComment(
        token,
        props.recipeId,
        comment.id
    );

    comments.value = comments.value.filter(
        (currentComment) =>
            currentComment.id !== comment.id
    );
  } catch (error) {
    errorMessage.value =
        getErrorMessage(error,"Impossible de supprimer ce commentaire")
  }
}

watch(
    () => props.recipeId,
    async () => {
      await loadComments();
    }
);

onMounted(async () => {
  await Promise.all([
    loadCurrentUser(),
    loadComments()
  ]);
});
</script>

<template>
  <section class="recipe-comments-panel">
    <div class="comments-topbar">
      <div>
        <p class="section-label">
          Commentaires
        </p>

        <h4>
          Discussion de recette
        </h4>
      </div>

      <button
          class="secondary-button"
          type="button"
          @click="loadComments"
      >
        Actualiser
      </button>
    </div>

    <p
        v-if="errorMessage"
        class="recipe-error"
    >
      {{ errorMessage }}
    </p>

    <form
        v-if="canWrite"
        class="comment-form"
        @submit.prevent="submitComment"
    >
      <textarea
          v-model="content"
          rows="3"
          maxlength="2000"
          placeholder="Ajouter un commentaire sur cette recette..."
      ></textarea>

      <button
          type="submit"
          :disabled="isSaving"
      >
        {{ isSaving ? "Envoi..." : "Envoyer" }}
      </button>
    </form>

    <p
        v-else
        class="recipe-info"
    >
      Votre rôle permet uniquement de lire les commentaires de cette recette.
    </p>

    <p
        v-if="isLoading"
        class="recipe-info"
    >
      Chargement des commentaires...
    </p>

    <div
        v-else
        class="comments-list"
    >
      <article
          v-for="comment in comments"
          :key="comment.id"
          class="comment-item"
      >
        <div class="comment-header">
          <div>
            <strong>
              {{ comment.author.displayName }}
            </strong>

            <span>
              {{ formatDateTime(comment.createdAt) }}
            </span>
          </div>

          <button
              v-if="canDelete(comment)"
              class="delete-comment-button"
              type="button"
              @click="removeComment(comment)"
          >
            Supprimer
          </button>
        </div>

        <p>
          {{ comment.content }}
        </p>
      </article>

      <p
          v-if="!comments.length"
          class="recipe-info"
      >
        Aucun commentaire pour cette recette.
      </p>
    </div>
  </section>
</template>

<style scoped>
.recipe-comments-panel {
  display: grid;
  gap: 14px;
}

.comments-topbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.comments-topbar h4 {
  margin: 0;
  color: #2f241d;
  font-size: 18px;
}

.section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
}

.comment-form {
  display: grid;
  gap: 10px;
}

.comment-form textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid #d9c7b2;
  border-radius: 16px;
  padding: 12px 14px;
  font-size: 14px;
  background: #fffdf8;
  color: #2f241d;
  font-family: inherit;
}

.comment-form textarea:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.comment-form button,
.secondary-button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 9px 15px;
  min-height: 36px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
}

.comments-list {
  display: grid;
  gap: 10px;
}

.comment-item {
  display: grid;
  gap: 8px;
  padding: 13px 14px;
  border: 1px solid #e2d2bd;
  border-radius: 16px;
  background: #fffdf8;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.comment-header div {
  display: grid;
  gap: 3px;
}

.comment-header strong {
  color: #2f241d;
  font-size: 14px;
  font-weight: 900;
}

.comment-header span {
  color: #6b5f55;
  font-size: 12px;
  font-weight: 800;
}

.comment-item p {
  margin: 0;
  color: #3b2d24;
  line-height: 1.5;
  white-space: pre-wrap;
}

.delete-comment-button {
  width: auto;
  min-width: 0;
  height: 32px;
  border: 1px solid #f3c6cf;
  border-radius: 999px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  background: #fff1f4;
  color: #be123c;
  box-shadow: none;
}

.delete-comment-button:hover {
  background: #ffe4ea;
}

.recipe-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 800;
}

.recipe-info {
  margin: 0;
  color: #5f5148;
  font-weight: 800;
}

@media (max-width: 700px) {
  .comments-topbar,
  .comment-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>