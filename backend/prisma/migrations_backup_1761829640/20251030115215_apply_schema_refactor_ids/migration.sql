/*
  Warnings:

  - The primary key for the `achievement_chains` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `achievement_goals` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `reward_badge_id` column on the `achievement_goals` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `admin_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `badge_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `badges` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `brand_survey_answers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `brand_survey_questions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `brand_surveys` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `brands` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bridge_followers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bridge_leaderboards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bridge_posts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bridge_rewards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bridge_user_stats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `choice_comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `comparison_metrics` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_collections` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_comment_votes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_favorites` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_likes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_post_tags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `content_post_views` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `user_id` column on the `content_post_views` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `content_posts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `main_category_id` column on the `content_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sub_category_id` column on the `content_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `product_group_id` column on the `content_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `product_id` column on the `content_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `content_ratings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `dm_feedbacks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `dm_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `dm_requests` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `dm_support_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `dm_threads` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `feed_highlights` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `feeds` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `inventories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `inventory_media` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `login_attempts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `user_id` column on the `login_attempts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `lootboxes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `main_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `manual_review_flags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `moderation_actions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `nft_attributes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `nft_claims` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `nft_id` column on the `nft_claims` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `nft_market_listings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `nft_transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `from_user_id` column on the `nft_transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `nfts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `password_reset_tokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `post_comparison_scores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `post_comparisons` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `post_questions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `related_product_id` column on the `post_questions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `post_tags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `post_tips` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `product_experiences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `product_groups` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `product_suggestions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `reviewed_by` column on the `product_suggestions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `group_id` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `reward_claims` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `scenario_choices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `sub_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tips_token_transfers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `top_community_choices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `trending_posts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `trust_relations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_achievements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_avatars` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_badges` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_collections` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_feed_preferences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_kyc_records` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `theme_id` column on the `user_settings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_themes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_titles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_trust_scores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wallets` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wishbox_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wishbox_rewards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wishbox_scenarios` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wishbox_stats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `achievement_chains` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `achievement_goals` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `chain_id` on the `achievement_goals` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `admin_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `admin_id` on the `admin_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `badge_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category_id` on the `badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `brand_survey_answers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `question_id` on the `brand_survey_answers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `brand_survey_answers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `brand_survey_questions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `survey_id` on the `brand_survey_questions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `brand_surveys` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `brand_surveys` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `brands` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `bridge_followers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `bridge_followers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `bridge_followers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `bridge_leaderboards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `bridge_leaderboards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `bridge_leaderboards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `bridge_posts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `bridge_posts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `bridge_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `bridge_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `bridge_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `badge_id` on the `bridge_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `bridge_user_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `bridge_user_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `brand_id` on the `bridge_user_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `choice_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `choice_id` on the `choice_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `choice_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `comparison_metrics` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_comment_votes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_comment_votes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_favorites` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_favorites` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_likes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_likes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_post_tags` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_post_views` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_posts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `content_ratings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_ratings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dm_feedbacks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `session_id` on the `dm_feedbacks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dm_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `thread_id` on the `dm_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sender_id` on the `dm_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dm_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `from_user_id` on the `dm_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `to_user_id` on the `dm_requests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dm_support_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `thread_id` on the `dm_support_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `helper_id` on the `dm_support_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dm_threads` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_one_id` on the `dm_threads` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_two_id` on the `dm_threads` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `feeds` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `inventories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `inventories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `inventories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `inventory_media` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `inventory_id` on the `inventory_media` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `login_attempts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `lootboxes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `lootboxes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `main_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `manual_review_flags` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `flagged_by_user_id` on the `manual_review_flags` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `moderation_actions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `moderator_id` on the `moderation_actions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `target_user_id` on the `moderation_actions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nft_attributes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nft_id` on the `nft_attributes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nft_claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `nft_claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nft_market_listings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nft_id` on the `nft_market_listings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `listed_by_user_id` on the `nft_market_listings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nft_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `nft_id` on the `nft_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `to_user_id` on the `nft_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `nfts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `password_reset_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `password_reset_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `post_comparison_scores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `comparison_id` on the `post_comparison_scores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `metric_id` on the `post_comparison_scores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `post_comparisons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_1_id` on the `post_comparisons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_2_id` on the `post_comparisons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `post_questions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `post_tags` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `post_tips` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `product_experiences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `inventory_id` on the `product_experiences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `product_groups` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sub_category_id` on the `product_groups` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `product_suggestions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `product_suggestions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `products` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `reward_claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `reward_claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `badge_id` on the `reward_claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `scenario_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `scenario_id` on the `scenario_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `scenario_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `sub_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `main_category_id` on the `sub_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `tips_token_transfers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `from_user_id` on the `tips_token_transfers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `to_user_id` on the `tips_token_transfers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `top_community_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `trust_relations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `truster_id` on the `trust_relations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `trusted_user_id` on the `trust_relations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_achievements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_achievements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `goal_id` on the `user_achievements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_avatars` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_avatars` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `badge_id` on the `user_badges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_feed_preferences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_feed_preferences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_kyc_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_kyc_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_settings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_settings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_themes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_titles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_titles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_trust_scores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_trust_scores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `wallets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `wallets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `wishbox_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `wishbox_rewards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `wishbox_scenarios` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `wishbox_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `wishbox_stats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "achievement_goals" DROP CONSTRAINT "achievement_goals_chain_id_fkey";

-- DropForeignKey
ALTER TABLE "achievement_goals" DROP CONSTRAINT "achievement_goals_reward_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "admin_logs" DROP CONSTRAINT "admin_logs_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "badges" DROP CONSTRAINT "badges_category_id_fkey";

-- DropForeignKey
ALTER TABLE "brand_survey_answers" DROP CONSTRAINT "brand_survey_answers_question_id_fkey";

-- DropForeignKey
ALTER TABLE "brand_survey_answers" DROP CONSTRAINT "brand_survey_answers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "brand_survey_questions" DROP CONSTRAINT "brand_survey_questions_survey_id_fkey";

-- DropForeignKey
ALTER TABLE "brand_surveys" DROP CONSTRAINT "brand_surveys_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_followers" DROP CONSTRAINT "bridge_followers_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_followers" DROP CONSTRAINT "bridge_followers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_leaderboards" DROP CONSTRAINT "bridge_leaderboards_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_leaderboards" DROP CONSTRAINT "bridge_leaderboards_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_posts" DROP CONSTRAINT "bridge_posts_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_posts" DROP CONSTRAINT "bridge_posts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_rewards" DROP CONSTRAINT "bridge_rewards_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_rewards" DROP CONSTRAINT "bridge_rewards_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_rewards" DROP CONSTRAINT "bridge_rewards_user_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_user_stats" DROP CONSTRAINT "bridge_user_stats_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "bridge_user_stats" DROP CONSTRAINT "bridge_user_stats_user_id_fkey";

-- DropForeignKey
ALTER TABLE "choice_comments" DROP CONSTRAINT "choice_comments_choice_id_fkey";

-- DropForeignKey
ALTER TABLE "choice_comments" DROP CONSTRAINT "choice_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_collections" DROP CONSTRAINT "content_collections_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_comment_votes" DROP CONSTRAINT "content_comment_votes_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "content_comment_votes" DROP CONSTRAINT "content_comment_votes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_comments" DROP CONSTRAINT "content_comments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "content_comments" DROP CONSTRAINT "content_comments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "content_comments" DROP CONSTRAINT "content_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_favorites" DROP CONSTRAINT "content_favorites_post_id_fkey";

-- DropForeignKey
ALTER TABLE "content_favorites" DROP CONSTRAINT "content_favorites_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_likes" DROP CONSTRAINT "content_likes_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "content_likes" DROP CONSTRAINT "content_likes_post_id_fkey";

-- DropForeignKey
ALTER TABLE "content_likes" DROP CONSTRAINT "content_likes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_post_tags" DROP CONSTRAINT "content_post_tags_post_id_fkey";

-- DropForeignKey
ALTER TABLE "content_post_views" DROP CONSTRAINT "content_post_views_post_id_fkey";

-- DropForeignKey
ALTER TABLE "content_post_views" DROP CONSTRAINT "content_post_views_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_main_category_id_fkey";

-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_product_group_id_fkey";

-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_product_id_fkey";

-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_sub_category_id_fkey";

-- DropForeignKey
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "content_ratings" DROP CONSTRAINT "content_ratings_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "content_ratings" DROP CONSTRAINT "content_ratings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_feedbacks" DROP CONSTRAINT "dm_feedbacks_session_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_messages" DROP CONSTRAINT "dm_messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_messages" DROP CONSTRAINT "dm_messages_thread_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_requests" DROP CONSTRAINT "dm_requests_from_user_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_requests" DROP CONSTRAINT "dm_requests_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_support_sessions" DROP CONSTRAINT "dm_support_sessions_helper_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_support_sessions" DROP CONSTRAINT "dm_support_sessions_thread_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_threads" DROP CONSTRAINT "dm_threads_user_one_id_fkey";

-- DropForeignKey
ALTER TABLE "dm_threads" DROP CONSTRAINT "dm_threads_user_two_id_fkey";

-- DropForeignKey
ALTER TABLE "feed_highlights" DROP CONSTRAINT "feed_highlights_post_id_fkey";

-- DropForeignKey
ALTER TABLE "feeds" DROP CONSTRAINT "feeds_post_id_fkey";

-- DropForeignKey
ALTER TABLE "feeds" DROP CONSTRAINT "feeds_user_id_fkey";

-- DropForeignKey
ALTER TABLE "inventories" DROP CONSTRAINT "inventories_product_id_fkey";

-- DropForeignKey
ALTER TABLE "inventories" DROP CONSTRAINT "inventories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_media" DROP CONSTRAINT "inventory_media_inventory_id_fkey";

-- DropForeignKey
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lootboxes" DROP CONSTRAINT "lootboxes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "manual_review_flags" DROP CONSTRAINT "manual_review_flags_flagged_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_moderator_id_fkey";

-- DropForeignKey
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_target_user_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_attributes" DROP CONSTRAINT "nft_attributes_nft_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_claims" DROP CONSTRAINT "nft_claims_nft_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_claims" DROP CONSTRAINT "nft_claims_user_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_market_listings" DROP CONSTRAINT "nft_market_listings_listed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_market_listings" DROP CONSTRAINT "nft_market_listings_nft_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_transactions" DROP CONSTRAINT "nft_transactions_from_user_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_transactions" DROP CONSTRAINT "nft_transactions_nft_id_fkey";

-- DropForeignKey
ALTER TABLE "nft_transactions" DROP CONSTRAINT "nft_transactions_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "post_comparison_scores" DROP CONSTRAINT "post_comparison_scores_comparison_id_fkey";

-- DropForeignKey
ALTER TABLE "post_comparison_scores" DROP CONSTRAINT "post_comparison_scores_metric_id_fkey";

-- DropForeignKey
ALTER TABLE "post_comparisons" DROP CONSTRAINT "post_comparisons_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_comparisons" DROP CONSTRAINT "post_comparisons_product_1_id_fkey";

-- DropForeignKey
ALTER TABLE "post_comparisons" DROP CONSTRAINT "post_comparisons_product_2_id_fkey";

-- DropForeignKey
ALTER TABLE "post_questions" DROP CONSTRAINT "post_questions_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_questions" DROP CONSTRAINT "post_questions_related_product_id_fkey";

-- DropForeignKey
ALTER TABLE "post_tags" DROP CONSTRAINT "post_tags_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_tips" DROP CONSTRAINT "post_tips_post_id_fkey";

-- DropForeignKey
ALTER TABLE "product_experiences" DROP CONSTRAINT "product_experiences_inventory_id_fkey";

-- DropForeignKey
ALTER TABLE "product_groups" DROP CONSTRAINT "product_groups_sub_category_id_fkey";

-- DropForeignKey
ALTER TABLE "product_suggestions" DROP CONSTRAINT "product_suggestions_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "product_suggestions" DROP CONSTRAINT "product_suggestions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_group_id_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_claims" DROP CONSTRAINT "reward_claims_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "reward_claims" DROP CONSTRAINT "reward_claims_user_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_choices" DROP CONSTRAINT "scenario_choices_scenario_id_fkey";

-- DropForeignKey
ALTER TABLE "scenario_choices" DROP CONSTRAINT "scenario_choices_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_categories" DROP CONSTRAINT "sub_categories_main_category_id_fkey";

-- DropForeignKey
ALTER TABLE "tips_token_transfers" DROP CONSTRAINT "tips_token_transfers_from_user_id_fkey";

-- DropForeignKey
ALTER TABLE "tips_token_transfers" DROP CONSTRAINT "tips_token_transfers_to_user_id_fkey";

-- DropForeignKey
ALTER TABLE "top_community_choices" DROP CONSTRAINT "top_community_choices_post_id_fkey";

-- DropForeignKey
ALTER TABLE "trending_posts" DROP CONSTRAINT "trending_posts_post_id_fkey";

-- DropForeignKey
ALTER TABLE "trust_relations" DROP CONSTRAINT "trust_relations_trusted_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trust_relations" DROP CONSTRAINT "trust_relations_truster_id_fkey";

-- DropForeignKey
ALTER TABLE "user_achievements" DROP CONSTRAINT "user_achievements_goal_id_fkey";

-- DropForeignKey
ALTER TABLE "user_achievements" DROP CONSTRAINT "user_achievements_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_avatars" DROP CONSTRAINT "user_avatars_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_badge_id_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_collections" DROP CONSTRAINT "user_collections_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_feed_preferences" DROP CONSTRAINT "user_feed_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_kyc_records" DROP CONSTRAINT "user_kyc_records_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_theme_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_titles" DROP CONSTRAINT "user_titles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_trust_scores" DROP CONSTRAINT "user_trust_scores_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_rewards" DROP CONSTRAINT "wishbox_rewards_event_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_rewards" DROP CONSTRAINT "wishbox_rewards_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_scenarios" DROP CONSTRAINT "wishbox_scenarios_event_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_stats" DROP CONSTRAINT "wishbox_stats_event_id_fkey";

-- DropForeignKey
ALTER TABLE "wishbox_stats" DROP CONSTRAINT "wishbox_stats_user_id_fkey";

-- AlterTable
ALTER TABLE "achievement_chains" DROP CONSTRAINT "achievement_chains_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "achievement_chains_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "achievement_goals" DROP CONSTRAINT "achievement_goals_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "chain_id",
ADD COLUMN     "chain_id" UUID NOT NULL,
DROP COLUMN "reward_badge_id",
ADD COLUMN     "reward_badge_id" UUID,
ADD CONSTRAINT "achievement_goals_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "admin_logs" DROP CONSTRAINT "admin_logs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "admin_id",
ADD COLUMN     "admin_id" UUID NOT NULL,
ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "badge_categories" DROP CONSTRAINT "badge_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "badge_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "badges" DROP CONSTRAINT "badges_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" UUID NOT NULL,
ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "brand_survey_answers" DROP CONSTRAINT "brand_survey_answers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "question_id",
ADD COLUMN     "question_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "brand_survey_answers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "brand_survey_questions" DROP CONSTRAINT "brand_survey_questions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "survey_id",
ADD COLUMN     "survey_id" UUID NOT NULL,
ADD CONSTRAINT "brand_survey_questions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "brand_surveys" DROP CONSTRAINT "brand_surveys_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
ADD CONSTRAINT "brand_surveys_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "brands" DROP CONSTRAINT "brands_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bridge_followers" DROP CONSTRAINT "bridge_followers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
ADD CONSTRAINT "bridge_followers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bridge_leaderboards" DROP CONSTRAINT "bridge_leaderboards_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "bridge_leaderboards_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bridge_posts" DROP CONSTRAINT "bridge_posts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "bridge_posts_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bridge_posts_id_seq";

-- AlterTable
ALTER TABLE "bridge_rewards" DROP CONSTRAINT "bridge_rewards_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
DROP COLUMN "badge_id",
ADD COLUMN     "badge_id" UUID NOT NULL,
ADD CONSTRAINT "bridge_rewards_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bridge_user_stats" DROP CONSTRAINT "bridge_user_stats_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "brand_id",
ADD COLUMN     "brand_id" UUID NOT NULL,
ADD CONSTRAINT "bridge_user_stats_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "choice_comments" DROP CONSTRAINT "choice_comments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "choice_id",
ADD COLUMN     "choice_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "choice_comments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "comparison_metrics" DROP CONSTRAINT "comparison_metrics_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "comparison_metrics_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_collections" DROP CONSTRAINT "content_collections_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "content_collections_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_comment_votes" DROP CONSTRAINT "content_comment_votes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "comment_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_comment_votes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_comments" DROP CONSTRAINT "content_comments_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "parent_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "content_comments_id_seq";

-- AlterTable
ALTER TABLE "content_favorites" DROP CONSTRAINT "content_favorites_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_favorites_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_likes" DROP CONSTRAINT "content_likes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ALTER COLUMN "comment_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_likes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_post_tags" DROP CONSTRAINT "content_post_tags_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_post_tags_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_post_views" DROP CONSTRAINT "content_post_views_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID,
ADD CONSTRAINT "content_post_views_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_posts" DROP CONSTRAINT "content_posts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "main_category_id",
ADD COLUMN     "main_category_id" UUID,
DROP COLUMN "sub_category_id",
ADD COLUMN     "sub_category_id" UUID,
DROP COLUMN "product_group_id",
ADD COLUMN     "product_group_id" UUID,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" UUID,
ADD CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "content_posts_id_seq";

-- AlterTable
ALTER TABLE "content_ratings" DROP CONSTRAINT "content_ratings_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "comment_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "content_ratings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dm_feedbacks" DROP CONSTRAINT "dm_feedbacks_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "session_id",
ADD COLUMN     "session_id" UUID NOT NULL,
ADD CONSTRAINT "dm_feedbacks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dm_messages" DROP CONSTRAINT "dm_messages_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "thread_id",
ADD COLUMN     "thread_id" UUID NOT NULL,
DROP COLUMN "sender_id",
ADD COLUMN     "sender_id" UUID NOT NULL,
ADD CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dm_requests" DROP CONSTRAINT "dm_requests_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "from_user_id",
ADD COLUMN     "from_user_id" UUID NOT NULL,
DROP COLUMN "to_user_id",
ADD COLUMN     "to_user_id" UUID NOT NULL,
ADD CONSTRAINT "dm_requests_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dm_support_sessions" DROP CONSTRAINT "dm_support_sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "thread_id",
ADD COLUMN     "thread_id" UUID NOT NULL,
DROP COLUMN "helper_id",
ADD COLUMN     "helper_id" UUID NOT NULL,
ADD CONSTRAINT "dm_support_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dm_threads" DROP CONSTRAINT "dm_threads_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_one_id",
ADD COLUMN     "user_one_id" UUID NOT NULL,
DROP COLUMN "user_two_id",
ADD COLUMN     "user_two_id" UUID NOT NULL,
ADD CONSTRAINT "dm_threads_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "feed_highlights" DROP CONSTRAINT "feed_highlights_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "feed_highlights_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "feed_highlights_id_seq";

-- AlterTable
ALTER TABLE "feeds" DROP CONSTRAINT "feeds_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "feeds_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "feeds_id_seq";

-- AlterTable
ALTER TABLE "inventories" DROP CONSTRAINT "inventories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" UUID NOT NULL,
ADD CONSTRAINT "inventories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "inventory_media" DROP CONSTRAINT "inventory_media_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "inventory_id",
ADD COLUMN     "inventory_id" UUID NOT NULL,
ADD CONSTRAINT "inventory_media_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID,
ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lootboxes" DROP CONSTRAINT "lootboxes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "lootboxes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "main_categories" DROP CONSTRAINT "main_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "main_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "manual_review_flags" DROP CONSTRAINT "manual_review_flags_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "flagged_by_user_id",
ADD COLUMN     "flagged_by_user_id" UUID NOT NULL,
ADD CONSTRAINT "manual_review_flags_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "moderator_id",
ADD COLUMN     "moderator_id" UUID NOT NULL,
DROP COLUMN "target_user_id",
ADD COLUMN     "target_user_id" UUID NOT NULL,
ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nft_attributes" DROP CONSTRAINT "nft_attributes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "nft_id",
ADD COLUMN     "nft_id" UUID NOT NULL,
ADD CONSTRAINT "nft_attributes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nft_claims" DROP CONSTRAINT "nft_claims_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "nft_id",
ADD COLUMN     "nft_id" UUID,
ADD CONSTRAINT "nft_claims_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nft_market_listings" DROP CONSTRAINT "nft_market_listings_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "nft_id",
ADD COLUMN     "nft_id" UUID NOT NULL,
DROP COLUMN "listed_by_user_id",
ADD COLUMN     "listed_by_user_id" UUID NOT NULL,
ADD CONSTRAINT "nft_market_listings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nft_transactions" DROP CONSTRAINT "nft_transactions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "nft_id",
ADD COLUMN     "nft_id" UUID NOT NULL,
DROP COLUMN "from_user_id",
ADD COLUMN     "from_user_id" UUID,
DROP COLUMN "to_user_id",
ADD COLUMN     "to_user_id" UUID NOT NULL,
ADD CONSTRAINT "nft_transactions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "nfts" DROP CONSTRAINT "nfts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "nfts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_comparison_scores" DROP CONSTRAINT "post_comparison_scores_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "comparison_id",
ADD COLUMN     "comparison_id" UUID NOT NULL,
DROP COLUMN "metric_id",
ADD COLUMN     "metric_id" UUID NOT NULL,
ADD CONSTRAINT "post_comparison_scores_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_comparisons" DROP CONSTRAINT "post_comparisons_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "product_1_id",
ADD COLUMN     "product_1_id" UUID NOT NULL,
DROP COLUMN "product_2_id",
ADD COLUMN     "product_2_id" UUID NOT NULL,
ADD CONSTRAINT "post_comparisons_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_questions" DROP CONSTRAINT "post_questions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "related_product_id",
ADD COLUMN     "related_product_id" UUID,
ADD CONSTRAINT "post_questions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_tags" DROP CONSTRAINT "post_tags_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_tips" DROP CONSTRAINT "post_tips_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "post_tips_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_experiences" DROP CONSTRAINT "product_experiences_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "inventory_id",
ADD COLUMN     "inventory_id" UUID NOT NULL,
ADD CONSTRAINT "product_experiences_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_groups" DROP CONSTRAINT "product_groups_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "sub_category_id",
ADD COLUMN     "sub_category_id" UUID NOT NULL,
ADD CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_suggestions" DROP CONSTRAINT "product_suggestions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "reviewed_by",
ADD COLUMN     "reviewed_by" UUID,
ADD CONSTRAINT "product_suggestions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "products" DROP CONSTRAINT "products_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "group_id",
ADD COLUMN     "group_id" UUID,
ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "user_name" SET DATA TYPE TEXT,
ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reward_claims" DROP CONSTRAINT "reward_claims_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "badge_id",
ADD COLUMN     "badge_id" UUID NOT NULL,
ADD CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "scenario_choices" DROP CONSTRAINT "scenario_choices_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "scenario_id",
ADD COLUMN     "scenario_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "scenario_choices_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sub_categories" DROP CONSTRAINT "sub_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "main_category_id",
ADD COLUMN     "main_category_id" UUID NOT NULL,
ADD CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tips_token_transfers" DROP CONSTRAINT "tips_token_transfers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "from_user_id",
ADD COLUMN     "from_user_id" UUID NOT NULL,
DROP COLUMN "to_user_id",
ADD COLUMN     "to_user_id" UUID NOT NULL,
ADD CONSTRAINT "tips_token_transfers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "top_community_choices" DROP CONSTRAINT "top_community_choices_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "top_community_choices_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "trending_posts" DROP CONSTRAINT "trending_posts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
ALTER COLUMN "post_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "trending_posts_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "trending_posts_id_seq";

-- AlterTable
ALTER TABLE "trust_relations" DROP CONSTRAINT "trust_relations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "truster_id",
ADD COLUMN     "truster_id" UUID NOT NULL,
DROP COLUMN "trusted_user_id",
ADD COLUMN     "trusted_user_id" UUID NOT NULL,
ADD CONSTRAINT "trust_relations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_achievements" DROP CONSTRAINT "user_achievements_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "goal_id",
ADD COLUMN     "goal_id" UUID NOT NULL,
ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_avatars" DROP CONSTRAINT "user_avatars_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "badge_id",
ADD COLUMN     "badge_id" UUID NOT NULL,
ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_collections" DROP CONSTRAINT "user_collections_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_collections_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_feed_preferences" DROP CONSTRAINT "user_feed_preferences_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_feed_preferences_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_kyc_records" DROP CONSTRAINT "user_kyc_records_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_kyc_records_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "theme_id",
ADD COLUMN     "theme_id" UUID,
ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_themes" DROP CONSTRAINT "user_themes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "user_themes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_titles" DROP CONSTRAINT "user_titles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_titles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_trust_scores" DROP CONSTRAINT "user_trust_scores_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_trust_scores_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wishbox_events" DROP CONSTRAINT "wishbox_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "wishbox_events_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "wishbox_events_id_seq";

-- AlterTable
ALTER TABLE "wishbox_rewards" DROP CONSTRAINT "wishbox_rewards_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "event_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "wishbox_rewards_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wishbox_scenarios" DROP CONSTRAINT "wishbox_scenarios_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "event_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "wishbox_scenarios_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wishbox_stats" DROP CONSTRAINT "wishbox_stats_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "event_id" SET DATA TYPE VARCHAR(26),
ADD CONSTRAINT "wishbox_stats_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_code_idx" ON "email_verification_codes"("user_id", "code");

-- CreateIndex
CREATE INDEX "email_verification_codes_email_code_idx" ON "email_verification_codes"("email", "code");

-- CreateIndex
CREATE UNIQUE INDEX "brand_survey_answers_question_id_user_id_key" ON "brand_survey_answers"("question_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_followers_user_id_brand_id_key" ON "bridge_followers"("user_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_leaderboards_brand_id_user_id_period_key" ON "bridge_leaderboards"("brand_id", "user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_user_stats_user_id_brand_id_key" ON "bridge_user_stats"("user_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_comment_votes_user_id_comment_id_key" ON "content_comment_votes"("user_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_favorites_user_id_post_id_key" ON "content_favorites"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_user_id_post_id_key" ON "content_likes"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_user_id_comment_id_key" ON "content_likes"("user_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_ratings_user_id_comment_id_key" ON "content_ratings"("user_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "dm_requests_from_user_id_to_user_id_key" ON "dm_requests"("from_user_id", "to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dm_threads_user_one_id_user_two_id_key" ON "dm_threads"("user_one_id", "user_two_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_user_id_product_id_key" ON "inventories"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_comparison_scores_comparison_id_metric_id_key" ON "post_comparison_scores"("comparison_id", "metric_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_choices_scenario_id_user_id_key" ON "scenario_choices"("scenario_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_relations_truster_id_trusted_user_id_key" ON "trust_relations"("truster_id", "trusted_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_goal_id_key" ON "user_achievements"("user_id", "goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_feed_preferences_user_id_key" ON "user_feed_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_provider_key" ON "wallets"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "wishbox_stats_user_id_event_id_key" ON "wishbox_stats"("user_id", "event_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "user_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_truster_id_fkey" FOREIGN KEY ("truster_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relations" ADD CONSTRAINT "trust_relations_trusted_user_id_fkey" FOREIGN KEY ("trusted_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feed_preferences" ADD CONSTRAINT "user_feed_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_kyc_records" ADD CONSTRAINT "user_kyc_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_experiences" ADD CONSTRAINT "product_experiences_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media" ADD CONSTRAINT "inventory_media_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_questions" ADD CONSTRAINT "post_questions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_questions" ADD CONSTRAINT "post_questions_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_product_1_id_fkey" FOREIGN KEY ("product_1_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparisons" ADD CONSTRAINT "post_comparisons_product_2_id_fkey" FOREIGN KEY ("product_2_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparison_scores" ADD CONSTRAINT "post_comparison_scores_comparison_id_fkey" FOREIGN KEY ("comparison_id") REFERENCES "post_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comparison_scores" ADD CONSTRAINT "post_comparison_scores_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "comparison_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tips" ADD CONSTRAINT "post_tips_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_tags" ADD CONSTRAINT "content_post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_likes" ADD CONSTRAINT "content_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_favorites" ADD CONSTRAINT "content_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_favorites" ADD CONSTRAINT "content_favorites_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_collections" ADD CONSTRAINT "content_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ratings" ADD CONSTRAINT "content_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ratings" ADD CONSTRAINT "content_ratings_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_votes" ADD CONSTRAINT "content_comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_votes" ADD CONSTRAINT "content_comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_views" ADD CONSTRAINT "content_post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_post_views" ADD CONSTRAINT "content_post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_community_choices" ADD CONSTRAINT "top_community_choices_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "badge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_goals" ADD CONSTRAINT "achievement_goals_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "achievement_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_goals" ADD CONSTRAINT "achievement_goals_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "achievement_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_posts" ADD CONSTRAINT "bridge_posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_posts" ADD CONSTRAINT "bridge_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_surveys" ADD CONSTRAINT "brand_surveys_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_questions" ADD CONSTRAINT "brand_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "brand_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_answers" ADD CONSTRAINT "brand_survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "brand_survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_survey_answers" ADD CONSTRAINT "brand_survey_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_followers" ADD CONSTRAINT "bridge_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_followers" ADD CONSTRAINT "bridge_followers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_user_stats" ADD CONSTRAINT "bridge_user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_user_stats" ADD CONSTRAINT "bridge_user_stats_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_leaderboards" ADD CONSTRAINT "bridge_leaderboards_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_leaderboards" ADD CONSTRAINT "bridge_leaderboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_rewards" ADD CONSTRAINT "bridge_rewards_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips_token_transfers" ADD CONSTRAINT "tips_token_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips_token_transfers" ADD CONSTRAINT "tips_token_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_transactions" ADD CONSTRAINT "nft_transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_market_listings" ADD CONSTRAINT "nft_market_listings_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_market_listings" ADD CONSTRAINT "nft_market_listings_listed_by_user_id_fkey" FOREIGN KEY ("listed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_attributes" ADD CONSTRAINT "nft_attributes_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lootboxes" ADD CONSTRAINT "lootboxes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_claims" ADD CONSTRAINT "nft_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_claims" ADD CONSTRAINT "nft_claims_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_scenarios" ADD CONSTRAINT "wishbox_scenarios_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_choices" ADD CONSTRAINT "scenario_choices_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "wishbox_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_choices" ADD CONSTRAINT "scenario_choices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choice_comments" ADD CONSTRAINT "choice_comments_choice_id_fkey" FOREIGN KEY ("choice_id") REFERENCES "scenario_choices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choice_comments" ADD CONSTRAINT "choice_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_stats" ADD CONSTRAINT "wishbox_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_stats" ADD CONSTRAINT "wishbox_stats_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_rewards" ADD CONSTRAINT "wishbox_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishbox_rewards" ADD CONSTRAINT "wishbox_rewards_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "wishbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_user_one_id_fkey" FOREIGN KEY ("user_one_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_threads" ADD CONSTRAINT "dm_threads_user_two_id_fkey" FOREIGN KEY ("user_two_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_requests" ADD CONSTRAINT "dm_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_support_sessions" ADD CONSTRAINT "dm_support_sessions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "dm_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_support_sessions" ADD CONSTRAINT "dm_support_sessions_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_feedbacks" ADD CONSTRAINT "dm_feedbacks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "dm_support_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_highlights" ADD CONSTRAINT "feed_highlights_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_posts" ADD CONSTRAINT "trending_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_review_flags" ADD CONSTRAINT "manual_review_flags_flagged_by_user_id_fkey" FOREIGN KEY ("flagged_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
