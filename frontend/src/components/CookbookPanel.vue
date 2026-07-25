<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getRecipes, type Recipe } from "../services/recipeService";
import {
  addCookbookMember,
  addRecipeToCookbook,
  createCookbook,
  getCookbook,
  getCookbookRecipes,
  getCookbooks,
  removeCookbookMember,
  removeRecipeFromCookbook,
  type Cookbook,
  type CookbookMember,
  type CookbookRecipe
} from "../services/cookbookService";
import CookbookMessagesPanel from "./CookbookMessagesPanel.vue";

const cookbooks = ref<Cookbook[]>([]);
const selectedCookbook = ref<Cookbook | null>(null);
const members = ref<CookbookMember[]>([]);
const cookbookRecipes = ref<CookbookRecipe[]>([]);
const personalRecipes = ref<Recipe[]>([]);
const name = ref("");
const description = ref("");
const memberEmail = ref("");
const memberRole = ref("READER");
const selectedRecipeId = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const recipeSearch = ref("");
const recipeTag = ref("");
const recipeIngredient = ref("");
const recipeMaxTotalTime = ref("");
const realtimeNotice = ref("");

const canManageMembers = computed(() => selectedCookbook.value?.role === "OWNER");
const canEditCookbook = computed(() => selectedCookbook.value?.role === "OWNER" || selectedCookbook.value?.role === "EDITOR");
const canComment = computed(() => {
  return selectedCookbook.value?.role === "OWNER" || selectedCookbook.value?.role === "EDITOR" || selectedCookbook.value?.role === "COMMENTATOR";
});

async function loadCookbooks() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getCookbooks(token);
    cookbooks.value = response.cookbooks;

    if (!selectedCookbook.value && response.cookbooks[0]) {
      await selectCookbook(response.cookbooks[0].id);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les cookbooks";
  } finally {
    isLoading.value = false;
  }
}

async function loadPersonalRecipes() {
  const token = getStoredToken();

  if (!token) {
    return;
  }

  const response = await getRecipes(token, {
    cookbookId: "personal"
  });
  personalRecipes.value = response.recipes;
}

async function loadCookbookRecipes() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  const response = await getCookbookRecipes(token, selectedCookbook.value.id, {
    q: recipeSearch.value || undefined,
    tag: recipeTag.value || undefined,
    ingredient: recipeIngredient.value || undefined,
    maxTotalTime: recipeMaxTotalTime.value ? Number(recipeMaxTotalTime.value) : undefined
  });

  cookbookRecipes.value = response.recipes;
}

async function selectCookbook(cookbookId: string) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  errorMessage.value = "";

  try {
    const cookbookResponse = await getCookbook(token, cookbookId);

    selectedCookbook.value = cookbookResponse.cookbook;
    members.value = cookbookResponse.members ?? [];
    await loadCookbookRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger ce cookbook";
  }
}

async function submitCookbook() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!name.value.trim()) {
    errorMessage.value = "Le nom du cookbook est obligatoire";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    const response = await createCookbook(token, name.value.trim(), description.value.trim());

    name.value = "";
    description.value = "";

    await loadCookbooks();
    await selectCookbook(response.cookbook.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de créer le cookbook";
  } finally {
    isSaving.value = false;
  }
}

async function submitMember() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  if (!memberEmail.value.trim()) {
    errorMessage.value = "L'email du membre est obligatoire";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await addCookbookMember(
        token,
        selectedCookbook.value.id,
        memberEmail.value.trim(),
        memberRole.value
    );

    memberEmail.value = "";
    memberRole.value = "READER";

    await loadCookbookRecipes();
    await loadCookbooks();
    await loadPersonalRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter ce membre";
  } finally {
    isSaving.value = false;
  }
}

async function removeMember(member: CookbookMember) {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  const confirmed = window.confirm(`Retirer ${member.displayName} du cookbook ?`);

  if (!confirmed) {
    return;
  }

  try {
    await removeCookbookMember(token, selectedCookbook.value.id, member.id);
    await loadCookbookRecipes();
    await loadCookbooks();
    await loadPersonalRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de retirer ce membre";
  }
}

async function submitRecipeToCookbook() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  if (!selectedRecipeId.value) {
    errorMessage.value = "Choisis une recette à ajouter";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await addRecipeToCookbook(token, selectedCookbook.value.id, selectedRecipeId.value);
    selectedRecipeId.value = "";
    await loadCookbookRecipes();
    await loadCookbooks();
    await loadPersonalRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter cette recette";
  } finally {
    isSaving.value = false;
  }
}

async function removeRecipe(recipe: CookbookRecipe) {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  const confirmed = window.confirm(`Retirer "${recipe.title}" du cookbook ?`);

  if (!confirmed) {
    return;
  }

  try {
    await removeRecipeFromCookbook(token, selectedCookbook.value.id, recipe.id);
    await loadCookbookRecipes();
    await loadCookbooks();
    await loadPersonalRecipes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de retirer cette recette";
  }
}

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function resetRecipeFilters() {
  recipeSearch.value = "";
  recipeTag.value = "";
  recipeIngredient.value = "";
  recipeMaxTotalTime.value = "";
  loadCookbookRecipes();
}

async function handleRealtimeCookbookUpdate() {
  const token = getStoredToken();

  if (!token || !selectedCookbook.value) {
    return;
  }

  try {
    const cookbookResponse = await getCookbook(token, selectedCookbook.value.id);

    selectedCookbook.value = cookbookResponse.cookbook;
    members.value = cookbookResponse.members ?? [];

    await Promise.all([
      loadCookbooks(),
      loadCookbookRecipes(),
      loadPersonalRecipes()
    ]);

    window.setTimeout(() => {
      realtimeNotice.value = "";
    }, 2500);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger la mise à jour du cookbook";
  }
}

onMounted(async () => {
  await Promise.all([
    loadCookbooks(),
    loadPersonalRecipes()
  ]);
});
</script>

<template>
  <section class="cookbook-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Cookbooks</p>
        <h3>Espaces partagés</h3>
      </div>

      <button class="secondary-button" type="button" @click="loadCookbooks">
        Actualiser
      </button>
    </div>

    <form class="cookbook-form" @submit.prevent="submitCookbook">
      <input v-model="name" type="text" placeholder="Nom du cookbook">
      <input v-model="description" type="text" placeholder="Description">

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Création..." : "Créer" }}
      </button>
    </form>

    <p v-if="errorMessage" class="recipe-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="recipe-info">
      Chargement des cookbooks...
    </p>

    <div class="cookbook-layout">
      <aside class="cookbook-list">
        <button
            v-for="cookbook in cookbooks"
            :key="cookbook.id"
            type="button"
            :class="{ active: selectedCookbook?.id === cookbook.id }"
            @click="selectCookbook(cookbook.id)"
        >
          <strong>{{ cookbook.name }}</strong>
          <span>{{ cookbook.recipeCount }} recette{{ cookbook.recipeCount > 1 ? "s" : "" }} · {{ cookbook.role }}</span>
        </button>

        <p v-if="!cookbooks.length && !isLoading" class="recipe-info">
          Aucun cookbook créé.
        </p>
      </aside>

      <article v-if="selectedCookbook" class="cookbook-detail">
        <div>
          <p class="section-label">{{ selectedCookbook.role }}</p>
          <h4>{{ selectedCookbook.name }}</h4>
          <p>{{ selectedCookbook.description || "Aucune description" }}</p>
        </div>

        <p v-if="realtimeNotice" class="success-message">
          {{ realtimeNotice }}
        </p>

        <div class="cookbook-block">
          <h5>Membres</h5>

          <form v-if="canManageMembers" class="member-form" @submit.prevent="submitMember">
            <input v-model="memberEmail" type="email" placeholder="email@supmeal.fr">

            <select v-model="memberRole">
              <option value="READER">Lecteur</option>
              <option value="COMMENTATOR">Commentateur</option>
              <option value="EDITOR">Éditeur</option>
            </select>

            <button type="submit" :disabled="isSaving">
              Ajouter
            </button>
          </form>

          <div class="member-list">
            <div v-for="member in members" :key="member.id" class="member-item">
              <div>
                <strong>{{ member.displayName }}</strong>
                <span>{{ member.email }} · {{ member.role }}</span>
              </div>

              <button
                  v-if="canManageMembers && member.role !== 'OWNER'"
                  class="danger-button"
                  type="button"
                  @click="removeMember(member)"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>

        <div class="cookbook-block">
          <div class="cookbook-block-header">
            <div>
              <h5>Recettes du cookbook</h5>
              <p>Recherche dédiée à ce cookbook.</p>
            </div>

            <button class="secondary-button" type="button" @click="loadCookbookRecipes">
              Actualiser
            </button>
          </div>

          <form class="recipe-filter-form" @submit.prevent="loadCookbookRecipes">
            <input v-model="recipeSearch" type="text" placeholder="Titre, étape, tag...">
            <input v-model="recipeTag" type="text" placeholder="Tag">
            <input v-model="recipeIngredient" type="text" placeholder="Ingrédient">
            <input v-model="recipeMaxTotalTime" type="number" min="0" placeholder="Temps max">

            <button type="submit">
              Rechercher
            </button>

            <button class="secondary-button" type="button" @click="resetRecipeFilters">
              Réinitialiser
            </button>
          </form>

          <form v-if="canEditCookbook" class="member-form" @submit.prevent="submitRecipeToCookbook">
            <select v-model="selectedRecipeId">
              <option value="">Choisir une recette</option>
              <option v-for="recipe in personalRecipes" :key="recipe.id" :value="recipe.id">
                {{ recipe.title }}
              </option>
            </select>

            <button type="submit" :disabled="isSaving">
              Ajouter la recette
            </button>
          </form>

          <div class="cookbook-recipes">
            <div v-for="recipe in cookbookRecipes" :key="recipe.id" class="cookbook-recipe">
              <div>
                <strong>{{ recipe.title }}</strong>
                <span>
                  {{ recipe.preparationTime + recipe.cookingTime }} min
                  <template v-if="recipe.owner"> · {{ recipe.owner.displayName }}</template>
                </span>

                <div v-if="recipe.tags?.length" class="recipe-tags">
                  <small v-for="tag in recipe.tags" :key="tag">{{ tag }}</small>
                </div>
              </div>

              <button
                  v-if="canEditCookbook"
                  class="danger-button"
                  type="button"
                  @click="removeRecipe(recipe)"
              >
                Retirer
              </button>
            </div>

            <p v-if="!cookbookRecipes.length" class="recipe-info">
              Aucune recette ne correspond à cette recherche.
            </p>
          </div>
        </div>

        <div class="cookbook-block">
          <CookbookMessagesPanel
              :cookbook-id="selectedCookbook.id"
              :role="selectedCookbook.role"
              :can-comment="canComment"
              @cookbook-updated="handleRealtimeCookbookUpdate"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.cookbook-panel {
  background: white;
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.08);
  display: grid;
  gap: 22px;
}

.cookbook-form,
.member-form,
.recipe-filter-form {
  display: grid;
  gap: 12px;
}

.cookbook-form,
.member-form {
  grid-template-columns: 1fr 1fr auto;
}

.recipe-filter-form {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.cookbook-form input,
.member-form input,
.member-form select,
.recipe-filter-form input {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  background: white;
}

.cookbook-form button,
.member-form button,
.recipe-filter-form button,
.secondary-button {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  font-weight: 800;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button {
  background: #f3f4f6;
  color: #111827;
}

.cookbook-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
}

.cookbook-list {
  display: grid;
  gap: 10px;
  align-content: start;
}

.cookbook-list button {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 14px;
  background: white;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.cookbook-list button.active {
  border-color: #f97316;
  background: #fff7ed;
}

.cookbook-list span,
.member-item span,
.cookbook-recipe span {
  color: #6b7280;
  font-size: 13px;
}

.cookbook-detail {
  display: grid;
  gap: 20px;
}

.cookbook-detail h4,
.cookbook-block h5 {
  margin: 0;
}

.cookbook-block {
  display: grid;
  gap: 14px;
}

.cookbook-block-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.cookbook-block-header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.member-list,
.cookbook-recipes {
  display: grid;
  gap: 10px;
}

.member-item,
.cookbook-recipe {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 12px 14px;
}

.member-item div,
.cookbook-recipe div {
  display: grid;
  gap: 3px;
}

.recipe-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.recipe-tags small {
  background: #ecfdf5;
  color: #047857;
  border-radius: 999px;
  padding: 4px 8px;
  font-weight: 800;
}

.danger-button {
  border: 0;
  border-radius: 999px;
  padding: 9px 12px;
  font-weight: 800;
  cursor: pointer;
  background: #fff1f2;
  color: #be123c;
}

.recipe-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

.recipe-info {
  margin: 0;
  color: #6b7280;
  font-weight: 700;
}

@media (max-width: 900px) {
  .cookbook-form,
  .member-form,
  .recipe-filter-form,
  .cookbook-layout {
    grid-template-columns: 1fr;
  }

  .cookbook-block-header {
    flex-direction: column;
  }
}

.success-message {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #ecfdf5;
  color: #047857;
  font-weight: 800;
}
</style>