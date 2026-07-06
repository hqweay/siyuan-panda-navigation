#!/bin/bash

run_release() {
  rel_comment="$1"

  new_version=$(node -p "require('./package.json').version")
  echo "当前最新版本号: $new_version"

  jq --arg v "$new_version" '.version = $v' plugin.json > tmpfile && mv tmpfile plugin.json

  node scripts/update-changelog-data.cjs

  if [ -z "$rel_comment" ]; then
    read -p "请输入发布备注说明 [回车默认为: upgrade to v$new_version]: " rel_comment
    if [ -z "$rel_comment" ]; then
      rel_comment="upgrade to v$new_version"
    fi
  fi

  echo "正在提交代码: upgrade#$new_version $rel_comment"
  git add .
  git commit -m "upgrade#$new_version $rel_comment"
  git push

  echo "正在打 Git 标签: $new_version"
  git tag -d "$new_version" 2>/dev/null
  git push origin :refs/tags/"$new_version" 2>/dev/null

  git tag "$new_version"
  git push origin "$new_version"

  echo "🎉 版本 v$new_version 发布成功！"
}

re_release() {
  current_version=$(node -p "require('./package.json').version")
  echo "当前最新版本号: $current_version"
  read -p "是否重新推送标签 $current_version 触发重打包？[Y/n]: " opt_re
  if [ "$opt_re" != "n" ] && [ "$opt_re" != "N" ]; then
    echo "正在重推 Git 标签: $current_version"
    git tag -d "$current_version" 2>/dev/null
    git push origin :refs/tags/"$current_version" 2>/dev/null
    git tag "$current_version"
    git push origin "$current_version"
    echo "🎉 标签 $current_version 重推成功，请前往 GitHub 查看 Action 状态！"
  fi
}

show_menu() {
  echo ""
  echo "========================================"
  echo " 🐼 熊猫导航 - 交互式发版控制台 🐼"
  echo "========================================"
  echo " 1) 📈 直接递增版本 (npm version)"
  echo " 2) 🚀 正式发布版本 (release)"
  echo " 3) 💬 快捷 Git 提交 (commit)"
  echo " 4) 🔄 重新触发打包 (re-release tag)"
  echo " 5) 🚪 退出菜单 (exit)"
  echo "========================================"
}

run_menu() {
  while true; do
    show_menu
    read -p "请选择操作 [1-5]: " opt
    case $opt in
      1)
        echo "--> 选择递增版本类型..."
        read -p "请输入版本类型 [patch/minor/major] (默认 patch): " bump_type
        bump_type=${bump_type:-patch}
        npm version "$bump_type" --no-git-tag-version
        new_version=$(node -p "require('./package.json').version")
        echo "版本已更新至: $new_version"
        ;;
      2)
        echo "--> 执行正式版本发布..."
        run_release
        ;;
      3)
        echo "--> 执行快捷 Git 提交..."
        read -p "请输入 Commit 消息: " commit_msg
        if [ -n "$commit_msg" ]; then
          git add .
          git commit -m "$commit_msg"
          git push
        else
          echo "错误: Commit 消息不能为空！"
        fi
        ;;
      4)
        echo "--> 执行重新打包..."
        re_release
        ;;
      5)
        echo "再见！👋"
        exit 0
        ;;
      *)
        echo "输入无效，请输入 1-5 之间的数字。"
        ;;
    esac
  done
}

if [ $# -eq 0 ]; then
  run_menu
else
  type_or_version="$1"
  comment="$2"

  if [ "$type_or_version" = "a" ]; then
    if [ -z "$comment" ]; then
      comment="update"
    fi
    echo "Executing quick commit: $comment"
    git add .
    git commit -m "$comment"
    git push
    exit 0
  fi

  if [ "$type_or_version" = "patch" ] || [ "$type_or_version" = "minor" ] || [ "$type_or_version" = "major" ]; then
    echo "Bumping version using npm version: $type_or_version"
    npm version "$type_or_version" --no-git-tag-version
    new_version=$(node -p "require('./package.json').version")
  elif [ -n "$type_or_version" ]; then
    new_version="$type_or_version"
    echo "Setting explicit version: $new_version"
    jq --arg v "$new_version" '.version = $v' package.json > tmpfile && mv tmpfile package.json
  fi

  run_release "$comment"
fi
