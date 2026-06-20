import os

locales_dir = r"c:\Users\nikhi\Downloads\Projects\Digital-Signage-Openclaude\lib\i18n\locales"
files = [
    ("de.ts", {
        "Wiedergabelisten": "Kampagnen",
        "Wiedergabeliste": "Kampagne",
        "Alle Wiedergabelisten": "Alle Kampagnen",
        "Ausgewählte Wiedergabeliste": "Ausgewählte Kampagne",
        "Keine Wiedergabeliste ausgewählt": "Keine Kampagne ausgewählt",
        "Wiedergabeliste ist leer": "Kampagne ist leer",
        "Warten auf Zuweisung von Asset oder Wiedergabeliste...": "Warten auf Zuweisung von Asset oder Kampagne...",
        "Zurück zu Wiedergabelisten": "Zurück zu Kampagnen",
        "Wiedergabeliste nicht gefunden": "Kampagne nicht gefunden",
        "Wiedergabeliste duplizieren": "Kampagne duplizieren",
        "Wiedergabeliste löschen": "Kampagne löschen",
        "Wiedergabeliste erfolgreich gespeichert": "Kampagne erfolgreich gespeichert",
        "Wiedergabeliste umbenannt": "Kampagne umbenannt",
        "Fehler beim Umbenennen": "Fehler beim Umbenennen der Kampagne",
        "Wiedergabeliste gelöscht": "Kampagne gelöscht",
        "Fehler beim Löschen": "Fehler beim Löschen der Kampagne",
        "Wiedergabeliste dupliziert": "Kampagne dupliziert",
        "Fehler beim Duplizieren": "Fehler beim Duplizieren der Kampagne",
        "Möchten Sie diese Wiedergabeliste wirklich löschen?": "Möchten Sie diese Kampagne wirklich löschen?",
        "Wiedergabeliste erstellt": "Kampagne erstellt",
        "Fügen Sie Medien hinzu.": "Fügen Sie Medien hinzu, um Ihre Kampagne zu erstellen.",
        "An {count} Bildschirm(e) gepusht": "Kampagne an {count} Bildschirm(e) gepusht",
        "Fehler beim Pushen.": "Fehler beim Pushen der Kampagne.",
        "Neue Wiedergabeliste": "Neue Kampagne",
        "Wiedergabeliste erstellen": "Kampagne erstellen",
        "Name der Wiedergabeliste": "Name der Kampagne",
        "Diese Playlist wurde von einem anderen Benutzer geändert. Bitte laden Sie die Seite neu, um die neuesten Änderungen zu erhalten.": "Diese Kampagne wurde von einem anderen Benutzer geändert. Bitte laden Sie die Seite neu, um die neuesten Änderungen zu erhalten.",
        "Wiedergabeliste angeheftet": "Kampagne angeheftet",
        "Wiedergabelisten": "Kampagnen",
        "Wiedergabeliste": "Kampagne",
    }),
    ("en.ts", {
        "Playlists": "Campaigns",
        "Playlist": "Campaign",
        "All playlists": "All campaigns",
        "Selected Playlist": "Selected Campaign",
        "No Playlist selected": "No Campaign selected",
        "Playlist is empty": "Campaign is empty",
        "Waiting for Asset or Playlist assignment...": "Waiting for Asset or Campaign assignment...",
        "Back to Playlists": "Back to Campaigns",
        "Playlist not found": "Campaign not found",
        "Duplicate Playlist": "Duplicate Campaign",
        "Delete Playlist": "Delete Campaign",
        "Playlist saved successfully": "Campaign saved successfully",
        "Playlist renamed": "Campaign renamed",
        "Failed to rename playlist": "Failed to rename campaign",
        "Playlist deleted": "Campaign deleted",
        "Failed to delete playlist": "Failed to delete campaign",
        "Playlist duplicated successfully": "Campaign duplicated successfully",
        "Failed to duplicate playlist": "Failed to duplicate campaign",
        "Are you sure you want to delete this playlist?": "Are you sure you want to delete this campaign?",
        "Playlist created": "Campaign created",
        "Add media to build your playlist.": "Add media to build your campaign.",
        "Playlist pushed to {count} screen(s) successfully": "Campaign pushed to {count} screen(s) successfully",
        "Failed to push playlist to screens.": "Failed to push campaign to screens.",
        "New Playlist": "New Campaign",
        "Create Playlist": "Create Campaign",
        "Playlist Name": "Campaign Name",
        "This playlist has been modified by another user. Please reload the page to get the latest changes.": "This campaign has been modified by another user. Please reload the page to get the latest changes.",
    }),
    ("es.ts", {
        "Listas de reproducción": "Campañas",
        "Lista de reproducción": "Campaña",
        "Todas las listas": "Todas las campañas",
        "Lista de reproducción seleccionada": "Campaña seleccionada",
        "Ninguna lista seleccionada": "Ninguna campaña seleccionada",
        "La lista de reproducción está vacía": "La campaña está vacía",
        "Esperando asignación de activo o lista de reproducción...": "Esperando asignación de activo o campaña...",
        "Volver a listas": "Volver a campañas",
        "Lista no encontrada": "Campaña no encontrada",
        "Duplicar lista": "Duplicar campaña",
        "Eliminar lista": "Eliminar campaña",
        "Lista guardada exitosamente": "Campaña guardada exitosamente",
        "Lista renombrada": "Campaña renombrada",
        "Error al renombrar": "Error al renombrar la campaña",
        "Lista eliminada": "Campaña eliminada",
        "Error al eliminar": "Error al eliminar la campaña",
        "Lista duplicada": "Campaña duplicada",
        "Error al duplicar": "Error al duplicar la campaña",
        "¿Desea eliminar esta lista?": "¿Está seguro de que desea eliminar esta campaña?",
        "Lista creada": "Campaña creada",
        "Agregue medios.": "Agregue medios para crear su campaña.",
        "Enviada a {count} pantalla(s)": "Campaña enviada a {count} pantalla(s) exitosamente",
        "Error al enviar.": "Error al enviar la campaña a las pantallas.",
        "Nueva lista de reproducción": "Nueva campaña",
        "Crear lista de reproducción": "Crear campaña",
        "Nombre de la lista de reproducción": "Nombre de la campaña",
        "Esta lista de reproducción ha sido modificada por otro usuario. Por favor, recarga la página para ver los últimos cambios.": "Esta campaña ha sido modificada por otro usuario. Por favor, recarga la página para ver los últimos cambios.",
    }),
    ("fr.ts", {
        "Listes de lecture": "Campagnes",
        "Liste de lecture": "Campagne",
        "Toutes les listes": "Toutes les campagnes",
        "Liste de lecture sélectionnée": "Campagne sélectionnée",
        "Aucune liste sélectionnée": "Aucune campagne sélectionnée",
        "La liste de lecture est vide": "La campagne est vide",
        "En attente d'attribution d'élément ou de liste de lecture...": "En attente d'attribution d'élément ou de campagne...",
        "Retour aux listes": "Retour aux campagnes",
        "Liste introuvable": "Campagne introuvable",
        "Dupliquer la liste": "Dupliquer la campagne",
        "Supprimer la liste": "Supprimer la campagne",
        "Liste enregistrée avec succès": "Campagne enregistrée avec succès",
        "Liste renommée": "Campagne renommée",
        "Échec du renommage": "Échec du renommage de la campagne",
        "Liste supprimée": "Campagne supprimée",
        "Échec de la suppression": "Échec de la suppression de la campagne",
        "Liste dupliquée": "Campagne dupliquée avec succès",
        "Échec de la duplication": "Échec de la duplication de la campagne",
        "Voulez-vous vraiment supprimer cette liste ?": "Voulez-vous vraiment supprimer cette campagne ?",
        "Liste créée": "Campagne créée",
        "Ajoutez des médias.": "Ajoutez des médias pour créer votre campagne.",
        "Envoyée à {count} écran(s)": "Campagne envoyée à {count} écran(s) avec succès",
        "Échec de l'envoi.": "Échec de l'envoi de la campagne aux écrans.",
        "Nouvelle playlist": "Nouvelle campagne",
        "Créer une playlist": "Créer une campagne",
        "Nom de la playlist": "Nom de la campagne",
    }),
    ("hi.ts", {
        "प्लेलिस्ट": "अभियान",
        "सभी प्लेलिस्ट": "सभी अभियान",
        "चयनित प्लेलिस्ट": "चयनित अभियान",
        "कोई प्लेलिस्ट चयनित नहीं": "कोई अभियान चयनित नहीं",
        "प्लेलिस्ट खाली है": "अभियान खाली है",
        "एसेट या प्लेलिस्ट असाइनमेंट की प्रतीक्षा की जा रही है...": "एसेट या अभियान असाइनमेंट की प्रतीक्षा की जा रही है...",
        "प्लेलिस्ट पर वापस जाएं": "अभियानों पर वापस जाएं",
        "प्लेलिस्ट नहीं मिली": "अभियान नहीं मिला",
        "प्लेलिस्ट दोहराएं": "अभियान दोहराएं",
        "प्लेलिस्ट हटाएं": "अभियान हटाएं",
        "प्लेलिस्ट सफलतापूर्वक सहेजी गई": "अभियाan सफलतापूर्वक सहेजा गया",
        "प्लेलिस्ट का नाम बदला गया": "अभियान का नाम बदला गया",
        "नाम बदलने में विफल": "अभियान का नाम बदलने में विफल",
        "प्लेलिस्ट हटाई गई": "अभियान हटाया गया",
        "हटाने में विफल": "अभियान हटाने में विफल",
        "प्लेलिस्ट सफलतापूर्वक दोहराई गई": "अभियान सफलतापूर्वक दोहराया गया",
        "दोहराने में विफल": "अभियान दोहराने में विफल",
        "क्या आप इस प्लेलिस्ट को हटाना चाहते हैं?": "क्या आप इस अभियान को हटाना चाहते हैं?",
        "प्लेलिस्ट बनाई गई": "अभियान बनाया गया",
        "मीडिया जोड़ें.": "अपना अभियान बनाने के लिए मीडिया जोड़ें।",
        "{count} स्क्रीन पर सफलतापूर्वक भेजी गई": "अभियान {count} स्क्रीन पर सफलतापूर्वक भेजा गया",
        "भेजने में विफल.": "अभियान भेजने में विफल।",
        "नई प्लेलिस्ट": "नया अभियान",
        "प्लेलिस्ट बनाएं": "अभियान बनाएं",
        "प्लेलिस्ट का नाम": "अभियान का नाम",
    }),
    ("it.ts", {
        "Playlist": "Campagna",  # Note: Italian uses same word 'Playlist' for singular/plural in general, but let's translate to Campagna/Campagne
        "Tutte le playlist": "Tutte le campagne",
        "Playlist selezionata": "Campagna selezionata",
        "Nessuna playlist selezionata": "Nessuna campagna selezionata",
        "La playlist è vuota": "La campagna è vuota",
        "In attesa di assegnazione di asset o playlist...": "In attesa di assegnazione di asset o campagna...",
        "Torna alle playlist": "Torna alle campagne",
        "Playlist non trovata": "Campagna non trovata",
        "Duplica playlist": "Duplica campagna",
        "Elimina playlist": "Elimina campagna",
        "Playlist salvata con successo": "Campagna salvata con successo",
        "Playlist rinominata": "Campagna rinominata",
        "Errore nella rinomina": "Errore nella rinomina della campagna",
        "Playlist eliminata": "Campagna eliminata",
        "Errore nella cancellazione": "Errore nella cancellazione della campagna",
        "Playlist duplicata": "Campagna duplicata con successo",
        "Errore nella duplicazione": "Errore nella duplicazione della campagna",
        "Eliminare questa playlist?": "Sei sicuro di voler eliminare questa campagna?",
        "Playlist creata": "Campagna creata",
        "Aggiungi media.": "Aggiungi elementi multimediali per creare la tua campagna.",
        "Inviata a {count} schermo/i": "Campagna inviata a {count} schermo/i con successo",
        "Errore nell'invio.": "Errore nell'invio della campagna agli schermi.",
        "Nuova playlist": "Nuova campagna",
        "Crea playlist": "Crea campagna",
        "Nome della playlist": "Nome della campagna",
        "Questa playlist è stata modificata da un altro utente. Ricarica la pagina per ottenere le ultime modifiche.": "Questa campagna è stata modificata da un altro utente. Ricarica la pagina per ottenere le ultime modifiche.",
    }),
    ("ja.ts", {
        "プレイリスト": "キャンペーン",
        "すべてのプレイリスト": "すべてのキャンペーン",
        "選択されたプレイリスト": "選択されたキャンペーン",
        "プレイリストが選択されていません": "キャンペーンが選択されていません",
        "プレイリストは空です": "キャンペーンは空です",
        "アセットまたはプレイリストの割り当てを待っています...": "アセットまたはキャンペーンの割り当てを待っています...",
        "プレイリストに戻る": "キャンペーンに戻る",
        "プレイリストが見つかりません": "キャンペーンが見つかりません",
        "プレイリストを複製": "キャンペーンを複製",
        "プレイリストを削除": "キャンペーンを削除",
        "プレイリストが正常に保存されました": "キャンペーンが正常に保存されました",
        "プレイリスト名を変更しました": "キャンペーン名を変更しました",
        "名前の変更に失敗しました": "キャンペーン名の変更に失敗しました",
        "プレイリストが削除されました": "キャンペーンが削除されました",
        "削除に失敗しました": "キャンペーンの削除に失敗しました",
        "プレイリストが複製されました": "キャンペーンが正常に複製されました",
        "複製に失敗しました": "キャンペーンの複製に失敗しました",
        "このプレイリストを削除しますか?": "このキャンペーンを削除しますか?",
        "プレイリストが作成されました": "キャンペーンが作成されました",
        "メディアを追加してください。": "メディアを追加してキャンペーンを作成します。",
        "{count}画面に送信しました": "キャンペーンを{count}画面に正常に送信しました",
        "送信に失敗しました。": "キャンペーンの送信に失敗しました。",
        "新規プレイリスト": "新規キャンペーン",
        "プレイリストの作成": "キャンペーンの作成",
        "プレイリスト名": "キャンペーン名",
    }),
    ("nl.ts", {
        "Afspeellijsten": "Campagnes",
        "Afspeellijst": "Campagne",
        "Alle afspeellijsten": "Alle campagnes",
        "Geselecteerde afspeellijst": "Geselecteerde campagne",
        "Geen afspeellijst geselecteerd": "Geen campagne geselecteerd",
        "Afspeellijst is leeg": "Campagne is leeg",
        "Wachten op toewijzing van item of afspeellijst...": "Wachten op toewijzing van item of campagne...",
        "Terug naar afspeellijsten": "Terug naar campagnes",
        "Afspeellijst niet gevonden": "Campagne niet gevonden",
        "Afspeellijst dupliceren": "Campagne dupliceren",
        "Afspeellijst verwijderen": "Campagne verwijderen",
        "Afspeellijst opgeslagen": "Campagne opgeslagen",
        "Afspeellijst hernoemd": "Campagne hernoemd",
        "Hernoemen mislukt": "Hernoemen van campagne mislukt",
        "Afspeellijst verwijderd": "Campagne verwijderd",
        "Verwijderen mislukt": "Verwijderen van campagne mislukt",
        "Afspeellijst gedupliceerd": "Campagne succesvol gedupliceerd",
        "Dupliceren mislukt": "Dupliceren van campagne mislukt",
        "Wilt u deze afspeellijst verwijderen?": "Weet u zeker dat u deze campagne wilt verwijderen?",
        "Afspeellijst aangemaakt": "Campagne aangemaakt",
        "Voeg media toe.": "Voeg media toe om uw campagne op te bouwen.",
        "Verstuurd naar {count} scherm(en)": "Campagne succesvol verstuurd naar {count} scherm(en)",
        "Versturen mislukt.": "Versturen van campagne naar schermen mislukt.",
        "Nieuwe afspeellijst": "Nieuwe campagne",
        "Afspeellijst maken": "Campagne maken",
        "Afspeellijstnaam": "Campagnenaam",
    }),
    ("pt.ts", {
        "Listas de reprodução": "Campanhas",
        "Lista de reprodução": "Campanha",
        "Todas as listas": "Todas as campanhas",
        "Lista de reprodução selecionada": "Campanha selecionada",
        "Nenhuma lista selecionada": "Nenhuma campanha selecionada",
        "A lista de reprodução está vazia": "A campanha está vazia",
        "Aguardando atribuição de ativo ou lista de reprodução...": "Aguardando atribuição de ativo ou campanha...",
        "Voltar para playlists": "Voltar para campanhas",
        "Playlist não encontrada": "Campanha não encontrada",
        "Duplicar playlist": "Duplicar campanha",
        "Excluir playlist": "Excluir campanha",
        "Playlist salva com sucesso": "Campanha salva com sucesso",
        "Playlist renomeada": "Campanha renomeada",
        "Falha ao renomear": "Falha ao renomear a campanha",
        "Playlist excluída": "Campanha excluída",
        "Falha ao excluir": "Falha ao excluir a campanha",
        "Playlist duplicada": "Campanha duplicada com sucesso",
        "Falha ao duplicar": "Falha ao duplicar a campanha",
        "Deseja excluir esta playlist?": "Tem certeza que deseja excluir esta campanha?",
        "Playlist criada": "Campanha criada",
        "Adicione mídias.": "Adicione mídias para criar a sua campanha.",
        "Enviada para {count} tela(s)": "Campanha enviada para {count} tela(s) com sucesso",
        "Falha ao enviar.": "Falha ao enviar a campanha para as telas.",
        "Nova lista de reprodução": "Nova campanha",
        "Criar lista de reprodução": "Criar campanha",
        "Nome da lista de reprodução": "Nome da campanha",
        "Esta lista de reprodução foi modificada por outro usuário. Recarregue a página para obter as alterações mais recentes.": "Esta campanha foi modificada por outro usuário. Recarregue a página para obter as alterações mais recentes.",
    }),
    ("sv.ts", {
        "Spellistor": "Kampanjer",
        "Spellista": "Kampanj",
        "Alla spellistor": "Alla kampanjer",
        "Vald spellista": "Vald kampanj",
        "Ingen spellista vald": "Ingen kampanj vald",
        "Spellistan är tom": "Kampanjen är tom",
        "Väntar på tilldelning av resurs eller spellista...": "Väntar på tilldelning av resurs eller kampanj...",
        "Tillbaka till spellistor": "Tillbaka till kampanjer",
        "Spellistan hittades inte": "Kampanjen hittades inte",
        "Duplicera spellista": "Duplicera kampanj",
        "Ta bort spellista": "Ta bort kampanj",
        "Spellistan sparades": "Kampanjen sparades",
        "Spellistan omdöpt": "Kampanjen omdöpt",
        "Det gick inte att byta namn": "Det gick inte att byta namn på kampanjen",
        "Spellistan borttagen": "Kampanjen borttagen",
        "Det gick inte att ta bort": "Det gick inte att ta bort kampanjen",
        "Spellistan duplicerades": "Kampanjen duplicerades med framgång",
        "Det gick inte att duplicera": "Det gick inte att duplicera kampanjen",
        "Vill du ta bort denna spellista?": "Är du säker på att du vill ta bort denna kampanj?",
        "Spellistan skapad": "Kampanjen skapad",
        "Lägg till media.": "Lägg till media för att skapa din kampanj.",
        "Skickad till {count} skärm(ar)": "Kampanjen skickades till {count} skärm(ar) med framgång",
        "Det gick inte att skicka.": "Det gick inte att skicka kampanjen till skärmarna.",
        "Ny spellista": "Ny kampanj",
        "Skapa spellista": "Skapa kampanj",
        "Spellistans namn": "Kampanjens namn",
        "Denna spellista har ändrats av en annan användare. Ladda om sidan för att se de senaste ändringarna.": "Denna kampanj har ändrats av en annan användare. Ladda om sidan för att se de senaste ändringarna.",
    })
]

# Standard key map for adding new Campaign keys that were not explicitly in locales before
new_keys_de = {
    "Search campaigns...": "Kampagnen suchen...",
    "No Campaigns Found": "Keine Kampagnen gefunden",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Erstellen Sie Ihre erste Kampagne, um Bilder, Videos und dynamische Widgets zu mischen.",
    "No campaigns matched your search criteria.": "Keine Kampagnen entsprechen Ihren Suchkriterien.",
    "Select Campaign Color": "Kampagnenfarbe auswählen"
}

new_keys_en = {
    "Search campaigns...": "Search campaigns...",
    "No Campaigns Found": "No Campaigns Found",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Create your first campaign to mix images, videos, and dynamic widgets together.",
    "No campaigns matched your search criteria.": "No campaigns matched your search criteria.",
    "Select Campaign Color": "Select Campaign Color"
}

new_keys_es = {
    "Search campaigns...": "Buscar campañas...",
    "No Campaigns Found": "No se encontraron campañas",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Cree su primera campaña para mezclar imágenes, videos y widgets dinámicos.",
    "No campaigns matched your search criteria.": "Ninguna campaña coincidió con sus criterios de búsqueda.",
    "Select Campaign Color": "Seleccionar color de campaña"
}

new_keys_fr = {
    "Search campaigns...": "Rechercher des campagnes...",
    "No Campaigns Found": "Aucune campagne trouvée",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Créez votre première campagne pour mélanger des images, des vidéos et des widgets dynamiques.",
    "No campaigns matched your search criteria.": "Aucune campagne ne correspond à vos critères de recherche.",
    "Select Campaign Color": "Sélectionner la couleur de la campagne"
}

new_keys_hi = {
    "Search campaigns...": "अभियानों की खोज करें...",
    "No Campaigns Found": "कोई अभियान नहीं मिला",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "छवियों, वीडियो और गतिशील विजेटों को एक साथ मिलाने के लिए अपना पहला अभियान बनाएं।",
    "No campaigns matched your search criteria.": "आपके खोज मानदंडों से कोई अभियान मेल नहीं खाता।",
    "Select Campaign Color": "अभियान का रंग चुनें"
}

new_keys_it = {
    "Search campaigns...": "Cerca campagne...",
    "No Campaigns Found": "Nessuna campagna trovata",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Crea la tua prima campagna per mescolare immagini, video e widget dinamici.",
    "No campaigns matched your search criteria.": "Nessuna campagna corrisponde ai criteri di ricerca.",
    "Select Campaign Color": "Seleziona colore campagna"
}

new_keys_ja = {
    "Search campaigns...": "キャンペーンを検索...",
    "No Campaigns Found": "キャンペーンが見つかりません",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "画像、動画、ダイナミックウィジェットを組み合わせた最初のキャンペーンを作成します。",
    "No campaigns matched your search criteria.": "検索条件に一致するキャンペーンはありませんでした。",
    "Select Campaign Color": "キャンペーンカラーを選択"
}

new_keys_nl = {
    "Search campaigns...": "Campagnes zoeken...",
    "No Campaigns Found": "Geen campagnes gevonden",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Maak uw eerste campagne om afbeeldingen, video's en dynamische widgets te combineren.",
    "No campaigns matched your search criteria.": "Geen campagnes kwamen overeen met uw zoekcriteria.",
    "Select Campaign Color": "Selecteer campagnekleur"
}

new_keys_pt = {
    "Search campaigns...": "Pesquisar campanhas...",
    "No Campaigns Found": "Nenhuma campanha encontrada",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Crie sua primeira campanha para mesclar imagens, vídeos e widgets dinâmicos.",
    "No campaigns matched your search criteria.": "Nenhuma campanha correspondeu aos seus critérios de pesquisa.",
    "Select Campaign Color": "Selecionar cor da campanha"
}

new_keys_sv = {
    "Search campaigns...": "Sök kampanjer...",
    "No Campaigns Found": "Inga kampanjer hittades",
    "Create your first campaign to mix images, videos, and dynamic widgets together.": "Skapa din första kampanj för att blanda bilder, videor och dynamiska widgetar.",
    "No campaigns matched your search criteria.": "Inga kampanjer matchade dina sökkriterier.",
    "Select Campaign Color": "Välj kampanjfärg"
}

lang_new_keys = {
    "de.ts": new_keys_de,
    "en.ts": new_keys_en,
    "es.ts": new_keys_es,
    "fr.ts": new_keys_fr,
    "hi.ts": new_keys_hi,
    "it.ts": new_keys_it,
    "ja.ts": new_keys_ja,
    "nl.ts": new_keys_nl,
    "pt.ts": new_keys_pt,
    "sv.ts": new_keys_sv,
}

# The main English keys mapping to rename key names themselves
english_key_rename = {
    "Playlists": "Campaigns",
    "Playlist": "Campaign",
    "All playlists": "All campaigns",
    "Selected Playlist": "Selected Campaign",
    "No Playlist selected": "No Campaign selected",
    "Playlist is empty": "Campaign is empty",
    "Waiting for Asset or Playlist assignment...": "Waiting for Asset or Campaign assignment...",
    "Back to Playlists": "Back to Campaigns",
    "Playlist not found": "Campaign not found",
    "Duplicate Playlist": "Duplicate Campaign",
    "Delete Playlist": "Delete Campaign",
    "Playlist saved successfully": "Campaign saved successfully",
    "Playlist renamed": "Campaign renamed",
    "Failed to rename playlist": "Failed to rename campaign",
    "Playlist deleted": "Campaign deleted",
    "Failed to delete playlist": "Failed to delete campaign",
    "Playlist duplicated successfully": "Campaign duplicated successfully",
    "Failed to duplicate playlist": "Failed to duplicate campaign",
    "Are you sure you want to delete this playlist?": "Are you sure you want to delete this campaign?",
    "Playlist created": "Campaign created",
    "Add media to build your playlist.": "Add media to build your campaign.",
    "Playlist pushed to {count} screen(s) successfully": "Campaign pushed to {count} screen(s) successfully",
    "Failed to push playlist to screens.": "Failed to push campaign to screens.",
    "New Playlist": "New Campaign",
    "Create Playlist": "Create Campaign",
    "Playlist Name": "Campaign Name",
}

for filename, translations in files:
    filepath = os.path.join(locales_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line is part of export const ...
        # Match pattern: 'Key': 'Value', or "Key": "Value",
        matched = False
        for original_val, campaign_val in translations.items():
            # Check if this original value is present in the line (either as a key or value)
            # e.g., 'Playlist': 'Wiedergabeliste',
            # We want to change it to 'Campaign': 'Kampagne',
            # Let's match exact key parts
            for eng_key, new_eng_key in english_key_rename.items():
                pattern_single = f"'{eng_key}': '{original_val}'"
                pattern_double = f'"{eng_key}": "{original_val}"'
                pattern_mixed1 = f"'{eng_key}': \"{original_val}\""
                pattern_mixed2 = f'"{eng_key}": \'{original_val}\''
                
                # Check for direct matches
                if pattern_single in line:
                    line = line.replace(pattern_single, f"'{new_eng_key}': '{campaign_val}'")
                    matched = True
                    break
                elif pattern_double in line:
                    line = line.replace(pattern_double, f'"{new_eng_key}": "{campaign_val}"')
                    matched = True
                    break
                elif pattern_mixed1 in line:
                    line = line.replace(pattern_mixed1, f"'{new_eng_key}': \"{campaign_val}\"")
                    matched = True
                    break
                elif pattern_mixed2 in line:
                    line = line.replace(pattern_mixed2, f'"{new_eng_key}": \'{campaign_val}\'')
                    matched = True
                    break
            
            if matched:
                break
        
        # Fallback substring replacement for comments or custom lines
        if not matched:
            if "Playlist Workspace" in line:
                line = line.replace("Playlist Workspace", "Campaign Workspace")
            
        new_lines.append(line)
        i += 1
        
    # Now append the new campaign-specific keys at the end before the closing curly brace
    # Let's find the closing curly brace '};'
    added_keys = False
    for j in range(len(new_lines)-1, -1, -1):
        if new_lines[j].strip() == "};":
            # Insert the new translations before this closing brace
            inserted_text = []
            for k, v in lang_new_keys[filename].items():
                inserted_text.append(f"  '{k}': '{v}',\n")
            new_lines.insert(j, "".join(inserted_text))
            added_keys = True
            break
            
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
        
    print(f"Successfully processed {filename} (added new keys: {added_keys})")
