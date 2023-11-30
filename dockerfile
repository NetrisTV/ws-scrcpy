# 使用 Node.js 14 作为基础镜像
FROM node:14

# 设置工作目录
WORKDIR /app

# 将主机上的 dist 目录内容复制到容器的 /app 目录
COPY dist/ .

# 安装应用程序的依赖（如果有 package.json 文件）
RUN npm install

# 暴露应用程序使用的端口（如果有需要）
EXPOSE 7932

# 运行应用程序
CMD ["node", "index.js"]
