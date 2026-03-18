FROM node:20-alpine

WORKDIR /app

# 复制依赖定义文件
COPY package*.json ./

# 安装所有依赖
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端静态文件 (Vite build)
RUN npm run build

# 暴露 54321 端口
EXPOSE 54321

# 启动 Node.js 服务
CMD ["npm", "run", "start"]
