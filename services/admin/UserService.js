// backend/services/admin/UserService.js
const User = require("../../models/User");
const { isValidObjectId } = require("mongoose");

class UserService {
  async getAllUsers(page = 1, limit = 20, filters = {}) {
    const skip = (page - 1) * limit;
    const query = {};

    if (filters.role) query.role = filters.role;
    if (filters.isVerified !== undefined) query.isVerified = filters.isVerified;
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      User.find(query, "-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  async getUserById(id) {
    if (!isValidObjectId(id)) {
      throw new Error("ID de usuario inválido");
    }
    const user = await User.findById(id, "-password");
    if (!user) throw new Error("Usuario no encontrado");
    return user;
  }

  async updateUser(id, updateData) {
    if (!isValidObjectId(id)) {
      throw new Error("ID de usuario inválido");
    }

    const allowedFields = ["role", "isVerified", "isActive"];
    const sanitizedData = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        sanitizedData[key] = updateData[key];
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      throw new Error("No hay campos válidos para actualizar");
    }

    if (
      sanitizedData.role &&
      !["user", "worker", "admin", "superadmin"].includes(sanitizedData.role)
    ) {
      throw new Error("Rol no válido");
    }

    const user = await User.findByIdAndUpdate(id, sanitizedData, {
      new: true,
      runValidators: true,
      select: "-password",
    });

    if (!user) throw new Error("Usuario no encontrado");
    return user;
  }

  async deleteUser(id) {
    if (!isValidObjectId(id)) {
      throw new Error("ID de usuario inválido");
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new Error("Usuario no encontrado");
    return { success: true, message: "Usuario eliminado" };
  }

  async getUserDistribution() {
    return await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
  }
}

module.exports = new UserService();
