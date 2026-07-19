<script setup lang="ts">
import { ref } from "vue";
import { exportAllData, importAllData, type FullDataExport } from "../services/dataService";

const fileInput = ref<HTMLInputElement | null>(null);
const isExporting = ref(false);
const isImporting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function buildExportFileName() {
  const date = new Date().toISOString().slice(0, 10);

  return `supmeal-export-${date}.json`;
}

function downloadJsonFile(payload: FullDataExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = buildExportFileName();
  link.click();

  URL.revokeObjectURL(url);
}

function openImportFile() {
  fileInput.value?.click();
}

async function exportData() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const confirmed = window.confirm("Le fichier exporté contiendra tes recettes et cookbooks. Continuer ?");

  if (!confirmed) {
    return;
  }

  isExporting.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const payload = await exportAllData(token);
    downloadJsonFile(payload);
    successMessage.value = "Export généré avec succès";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'exporter les données";
  } finally {
    isExporting.value = false;
  }
}

async function importDataFile(event: Event) {
  const token = getStoredToken();
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!file) {
    return;
  }

  const confirmed = window.confirm("L'import va ajouter les recettes et cookbooks du fichier à ton compte. Continuer ?");

  if (!confirmed) {
    input.value = "";
    return;
  }

  isImporting.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const content = await file.text();
    const payload = JSON.parse(content) as FullDataExport;
    const response = await importAllData(token, payload);

    successMessage.value = `${response.message} : ${response.summary.importedRecipes} recette(s), ${response.summary.importedCookbooks} cookbook(s)`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'importer les données";
  } finally {
    input.value = "";
    isImporting.value = false;
  }
}
</script>

<template>
  <section class="data-panel">
    <div>
      <p class="section-label">Import / export</p>
      <h3>Données SUPMEAL</h3>
    </div>

    <p class="data-warning">
      L'export contient les recettes et cookbooks dans un fichier.
    </p>

    <div class="data-actions">
      <input
          ref="fileInput"
          type="file"
          accept="application/json"
          class="hidden-file-input"
          @change="importDataFile"
      >

      <button type="button" :disabled="isExporting" @click="exportData">
        {{ isExporting ? "Export..." : "Exporter toutes mes données" }}
      </button>

      <button class="secondary-button" type="button" :disabled="isImporting" @click="openImportFile">
        {{ isImporting ? "Import..." : "Importer un export SUPMEAL" }}
      </button>
    </div>

    <p v-if="errorMessage" class="data-error">
      {{ errorMessage }}
    </p>

    <p v-if="successMessage" class="data-success">
      {{ successMessage }}
    </p>
  </section>
</template>

<style scoped>
.data-panel {
  background: white;
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.08);
  display: grid;
  gap: 18px;
}

.section-label {
  margin: 0 0 4px;
  color: #f97316;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.data-panel h3 {
  margin: 0;
}

.data-warning,
.data-error,
.data-success {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  font-weight: 700;
}

.data-warning {
  background: #fffbeb;
  color: #92400e;
}

.data-error {
  background: #fff7f7;
  color: #b91c1c;
}

.data-success {
  background: #ecfdf5;
  color: #047857;
}

.data-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.data-actions button {
  border: 0;
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.data-actions .secondary-button {
  background: #f3f4f6;
  color: #111827;
}

.data-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.hidden-file-input {
  display: none;
}
</style>