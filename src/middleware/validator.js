const Joi = require("joi");

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  // Login validation
  login: Joi.object({
    username: Joi.string().lowercase().required(),
    pin: Joi.string()
      .length(4)
      .pattern(/^[0-9]+$/)
      .required(),
  }),

  // Create staff validation
  createStaff: Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    username: Joi.string().lowercase().min(3).max(50).required(),
    pin: Joi.string()
      .length(4)
      .pattern(/^[0-9]+$/)
      .required(),
    role: Joi.string()
      .valid("waitress", "kitchen", "juicebar", "owner")
      .required(),
  }),

  // Create menu item validation
  createMenuItem: Joi.object({
    name: Joi.object({
      en: Joi.string().required(),
      am: Joi.string().required(),
    }).required(),
    description: Joi.object({
      en: Joi.string().allow(""),
      am: Joi.string().allow(""),
    }),
    pricing: Joi.object({
      dineIn: Joi.number().min(0).required(),
      takeaway: Joi.number().min(0).required(),
      hasDifferentTakeawayPrice: Joi.boolean(),
    }).required(),
    categoryId: Joi.string().required(),
    prepStation: Joi.string().valid("kitchen", "juicebar", "none").required(),
    requiresPreparation: Joi.boolean(),
    addOns: Joi.array().items(Joi.string()),
  }),

  // Create order validation
  createOrder: Joi.object({
    orderType: Joi.string().valid("dine-in", "takeaway").required(),
    customerName: Joi.string().allow(""),
    customerPhone: Joi.string().allow(""),
    items: Joi.array()
      .min(1)
      .items(
        Joi.object({
          itemId: Joi.string().required(),
          variant: Joi.string().allow(""),
          quantity: Joi.number().min(1).required(),
          pricePerUnit: Joi.number().min(0).required(),
          addOns: Joi.array().items(
            Joi.object({
              addonId: Joi.string().required(),
              name: Joi.object({
                en: Joi.string().required(),
                am: Joi.string().required(),
              }),
              price: Joi.number().min(0).required(),
            })
          ),
          specialNotes: Joi.string().allow(""),
          autoComplete: Joi.boolean(),
          skipKitchen: Joi.boolean(),
        })
      )
      .required(),
  }),
};

module.exports = { validateRequest, schemas };
