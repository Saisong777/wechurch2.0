const CONTENT_EXPORT_DIR = "exports/content";

const TABLES = [
  {
    key: "bible",
    table: "chinese_union_trad",
    orderBy: "book_number NULLS LAST, chapter, verse",
    columns: [
      ["verseId", "verse_id"],
      ["bookName", "book_name"],
      ["bookNumber", "book_number"],
      ["chapter", "chapter"],
      ["verse", "verse"],
      ["text", "text"],
    ],
  },
  {
    key: "blessing-verses",
    table: "blessing_verses",
    orderBy: "id",
    columns: [
      ["id", "id"],
      ["verseId", "verse_id"],
      ["bookName", "book_name"],
      ["bookNumber", "book_number"],
      ["chapter", "chapter"],
      ["verse", "verse"],
      ["text", "text"],
      ["blessingVerse", "blessing_verse"],
      ["blessingType", "blessing_type"],
      ["aiPastoralSafety", "ai_pastoral_safety"],
      ["textNorm", "text_norm"],
      ["upliftScore", "uplift_score"],
      ["emotionalFocus", "emotional_focus"],
      ["createdAt", "created_at"],
    ],
  },
  {
    key: "jesus-4seasons",
    table: "jesus_4seasons",
    orderBy: "display_order, id",
    columns: [
      ["id", "id"],
      ["displayOrder", "display_order"],
      ["eventId", "event_id"],
      ["dateMaybe", "date_maybe"],
      ["dateStage", "date_stage"],
      ["stageShort", "stage_short"],
      ["season", "season"],
      ["approximateDate", "approximate_date"],
      ["location", "location"],
      ["eventName", "event_name"],
      ["eventCategory", "event_category"],
      ["theologicalTheme", "theological_theme"],
      ["jesusCharacter", "jesus_character"],
      ["focus", "focus"],
      ["gospelCenter", "gospel_center"],
      ["scriptureOverview", "scripture_overview"],
      ["scriptureMt", "scripture_mt"],
      ["scriptureMk", "scripture_mk"],
      ["scriptureLk", "scripture_lk"],
      ["scriptureJn", "scripture_jn"],
      ["scriptureStatus", "scripture_status"],
      ["harmonyPrinciple", "harmony_principle"],
      ["dateConfidence", "date_confidence"],
      ["orderConfidence", "order_confidence"],
      ["dataType", "data_type"],
      ["categoryFiveMain", "category_five_main"],
      ["categoryResearchBasis", "category_research_basis"],
      ["teachingThemeResearch", "teaching_theme_research"],
      ["categoryResearchDetail", "category_research_detail"],
      ["teachingKingdomSecondary", "teaching_kingdom_secondary"],
      ["parableSecondary", "parable_secondary"],
      ["miracleSecondary", "miracle_secondary"],
      ["categoryResearchFinal", "category_research_final"],
      ["demonstrationSecondary", "demonstration_secondary"],
      ["wisdomSecondary", "wisdom_secondary"],
      ["humorSecondary", "humor_secondary"],
      ["categoryResearchUltimate", "category_research_ultimate"],
      ["categoryTags", "category_tags"],
      ["ntCrossReference", "nt_cross_reference"],
      ["ntCrossReferenceReason", "nt_cross_reference_reason"],
      ["ntCrossReferenceEvent", "nt_cross_reference_event"],
      ["ntCrossReferenceConclusion", "nt_cross_reference_conclusion"],
      ["themeIndexResearch", "theme_index_research"],
      ["otMessiahCrossRef", "ot_messiah_cross_ref"],
      ["otScriptureQuoteJesus", "ot_scripture_quote_jesus"],
      ["typologyPeople", "typology_people"],
      ["otScriptureQuoteJesusExpanded", "ot_scripture_quote_jesus_expanded"],
      ["typologyPrimaryLevel", "typology_primary_level"],
      ["typologySecondaryLevel", "typology_secondary_level"],
      ["gospelCenterMicroNarrative", "gospel_center_micro_narrative"],
      ["gospelCenterOld", "gospel_center_old"],
      ["userPainPointTags", "user_pain_point_tags"],
      ["takeawayPhrase", "takeaway_phrase"],
      ["userPainPointPrimary", "user_pain_point_primary"],
      ["userPainPointSecondary", "user_pain_point_secondary"],
    ],
  },
];

function pgConfig(connectionString) {
  const url = new URL(connectionString);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  return {
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  };
}

function isLocalDatabase(connectionString) {
  const url = new URL(connectionString);
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

module.exports = {
  CONTENT_EXPORT_DIR,
  TABLES,
  pgConfig,
  isLocalDatabase,
};
